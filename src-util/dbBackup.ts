import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Pool } from 'pg'

const BACKUP_FILE_PATH = path.resolve(process.cwd(), 'data/db/bkp/db.json')

type BackupFile = {
  meta: {
    createdAt: string
    databaseUrlHost: string | null
    tableCount: number
  }
  tables: Record<string, Array<Record<string, unknown>>>
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

function getDatabaseHost(connectionString: string): string | null {
  try {
    return new URL(connectionString).host
  } catch {
    return null
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.')
  }

  const pool = new Pool({ connectionString })

  try {
    const tableResult = await pool.query<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
      `,
    )

    const tableNames = tableResult.rows.map((row) => row.table_name)
    const tables: BackupFile['tables'] = {}

    for (const tableName of tableNames) {
      const sql = `SELECT * FROM ${quoteIdentifier(tableName)};`
      const result = await pool.query<Record<string, unknown>>(sql)
      tables[tableName] = result.rows
      console.log(`Backed up ${tableName}: ${result.rowCount ?? 0} rows`)
    }

    const payload: BackupFile = {
      meta: {
        createdAt: new Date().toISOString(),
        databaseUrlHost: getDatabaseHost(connectionString),
        tableCount: tableNames.length,
      },
      tables,
    }

    await mkdir(path.dirname(BACKUP_FILE_PATH), { recursive: true })
    await writeFile(BACKUP_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8')

    console.log(`Backup written to ${BACKUP_FILE_PATH}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Database backup failed:', error)
  process.exitCode = 1
})
