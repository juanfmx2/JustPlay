import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Pool, type PoolClient } from 'pg'

const BACKUP_FILE_PATH = path.resolve(process.cwd(), 'data/db/bkp/db.json')
const INSERT_BATCH_SIZE = 200

type BackupFile = {
  meta?: {
    createdAt?: string
    tableCount?: number
  }
  tables: Record<string, Array<Record<string, unknown>>>
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

function buildInsertQuery(tableName: string, columns: string[], rowCount: number): string {
  const quotedColumns = columns.map(quoteIdentifier).join(', ')
  const placeholders = Array.from({ length: rowCount }, (_, rowIndex) => {
    const values = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`)
    return `(${values.join(', ')})`
  }).join(', ')

  return `INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns}) VALUES ${placeholders};`
}

async function insertRowsInBatches(
  client: PoolClient,
  tableName: string,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return

  const columns = Object.keys(rows[0])
  if (columns.length === 0) return

  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + INSERT_BATCH_SIZE)
    const query = buildInsertQuery(tableName, columns, batch.length)
    const params = batch.flatMap((row) => columns.map((column) => row[column] ?? null))
    await client.query(query, params)
  }
}

async function resetSerialSequences(client: PoolClient, tableNames: string[]): Promise<void> {
  for (const tableName of tableNames) {
    const serialColumnsResult = await client.query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_default LIKE 'nextval(%'
      ORDER BY ordinal_position;
      `,
      [tableName],
    )

    for (const { column_name: columnName } of serialColumnsResult.rows) {
      const sequenceResult = await client.query<{ sequence_name: string | null }>(
        'SELECT pg_get_serial_sequence($1, $2) AS sequence_name;',
        [`public.${tableName}`, columnName],
      )
      const sequenceName = sequenceResult.rows[0]?.sequence_name
      if (!sequenceName) continue

      const maxValueResult = await client.query<{ max_value: string | null }>(
        `SELECT MAX(${quoteIdentifier(columnName)})::text AS max_value FROM ${quoteIdentifier(tableName)};`,
      )
      const maxValueRaw = maxValueResult.rows[0]?.max_value
      const maxValue = maxValueRaw ? Number(maxValueRaw) : 0

      if (maxValue > 0) {
        await client.query('SELECT setval($1::regclass, $2, true);', [sequenceName, maxValue])
      } else {
        await client.query('SELECT setval($1::regclass, 1, false);', [sequenceName])
      }
    }
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.')
  }

  const fileText = await readFile(BACKUP_FILE_PATH, 'utf8')
  const parsed = JSON.parse(fileText) as BackupFile

  if (!parsed || typeof parsed !== 'object' || !parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error(`Invalid backup file format at ${BACKUP_FILE_PATH}`)
  }

  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    const existingTablesResult = await client.query<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
      `,
    )

    const existingTableNames = existingTablesResult.rows.map((row) => row.table_name)
    const backupTableNames = Object.keys(parsed.tables)

    const unknownBackupTables = backupTableNames.filter((tableName) => !existingTableNames.includes(tableName))
    if (unknownBackupTables.length > 0) {
      console.warn(
        `Skipping ${unknownBackupTables.length} table(s) not present in current schema: ${unknownBackupTables.join(', ')}`,
      )
    }

    await client.query('BEGIN')

    const truncateList = existingTableNames.map((tableName) => quoteIdentifier(tableName)).join(', ')
    if (truncateList.length > 0) {
      await client.query(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE;`)
    }

    const pending = new Map<string, Array<Record<string, unknown>>>()
    for (const tableName of backupTableNames) {
      if (!existingTableNames.includes(tableName)) continue
      const rows = parsed.tables[tableName]
      if (!Array.isArray(rows)) {
        throw new Error(`Table payload for ${tableName} is not an array.`)
      }
      pending.set(tableName, rows)
    }

    while (pending.size > 0) {
      let insertedInThisPass = 0

      for (const [tableName, rows] of [...pending.entries()]) {
        try {
          await insertRowsInBatches(client, tableName, rows)
          pending.delete(tableName)
          insertedInThisPass += 1
          console.log(`Restored ${tableName}: ${rows.length} rows`)
        } catch (error) {
          const pgError = error as { code?: string }
          if (pgError?.code === '23503') {
            continue
          }
          throw error
        }
      }

      if (insertedInThisPass === 0) {
        throw new Error(
          `Restore could not resolve table dependency order. Remaining tables: ${[...pending.keys()].join(', ')}`,
        )
      }
    }

    await resetSerialSequences(client, existingTableNames)
    await client.query('COMMIT')

    console.log(`Restore completed from ${BACKUP_FILE_PATH}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Database restore failed:', error)
  process.exitCode = 1
})
