import 'dotenv/config'
import { getTableName, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from '../src/schema'

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is required to connect to PostgreSQL.')
}

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
})

const db = drizzle(pool, { schema })
const ENUM_TYPES_TO_DROP = ['competition_type', 'stage_type', 'division_type'] as const
const DRIZZLE_INTERNAL_TABLES = [
	{ schemaName: 'drizzle', tableName: '__drizzle_migrations' },
	{ schemaName: 'public', tableName: '__drizzle_migrations' },
] as const

function discoverSchemaTables(): string[] {
	const names = new Set<string>()

	for (const value of Object.values(schema)) {
		if (!value || typeof value !== 'object') {
			continue
		}

		try {
			const tableName = getTableName(value as never)
			if (tableName) {
				names.add(tableName)
			}
		} catch {
			// Not a table export (e.g. relations, enums, helper objects).
		}
	}

	return Array.from(names).sort((a, b) => a.localeCompare(b))
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replace(/"/g, '""')}"`
}

function quoteQualifiedIdentifier(schemaName: string, tableName: string): string {
	return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`
}

async function tableExists(
	executor: { execute: typeof db.execute },
	tableName: string,
): Promise<boolean> {
	const result = await executor.execute<{ table: string | null }>(
		sql`SELECT to_regclass(${`public.${tableName}`}) AS table`,
	)
	const row = result.rows[0]

	return row?.table !== null
}

async function dropTablesIndividually() {
	const schemaTables = discoverSchemaTables()

	console.log(`Tables defined in src/schema (${schemaTables.length}):`)
	for (const tableName of schemaTables) {
		console.log(`- ${tableName}`)
	}

	let deletedCount = 0
	let notFoundCount = 0
	let failedCount = 0

	for (const tableName of schemaTables) {
		try {
			const deleted = await db.transaction(async (tx) => {
				const found = await tableExists(tx, tableName)
				console.log(`[${tableName}] found=${found}`)

				if (!found) {
					return false
				}

				const tableIdentifier = quoteIdentifier(tableName)

				await tx.execute(
					sql.raw(
						`TRUNCATE TABLE ${tableIdentifier} RESTART IDENTITY CASCADE;`,
					),
				)
				await tx.execute(sql.raw(`DROP TABLE ${tableIdentifier} CASCADE;`))

				return true
			})

			if (deleted) {
				deletedCount += 1
				console.log(`[${tableName}] deleted=true`)
			} else {
				notFoundCount += 1
				console.log(`[${tableName}] deleted=false (table not present)`)
			}
		} catch (error) {
			failedCount += 1
			console.error(
				`[${tableName}] deleted=false (error: ${error instanceof Error ? error.message : String(error)})`,
			)
		}
	}

	console.log(
		`Done: deleted=${deletedCount}, notFound=${notFoundCount}, failed=${failedCount}, total=${schemaTables.length}`,
	)

	let internalDroppedCount = 0
	let internalFailedCount = 0

	console.log(`Drizzle internal tables to drop (${DRIZZLE_INTERNAL_TABLES.length}):`)
	for (const tableRef of DRIZZLE_INTERNAL_TABLES) {
		console.log(`- ${tableRef.schemaName}.${tableRef.tableName}`)
	}

	for (const tableRef of DRIZZLE_INTERNAL_TABLES) {
		try {
			const tableIdentifier = quoteQualifiedIdentifier(
				tableRef.schemaName,
				tableRef.tableName,
			)
			await db.execute(sql.raw(`DROP TABLE IF EXISTS ${tableIdentifier} CASCADE;`))
			internalDroppedCount += 1
			console.log(`[${tableRef.schemaName}.${tableRef.tableName}] dropped=true`)
		} catch (error) {
			internalFailedCount += 1
			console.error(
				`[${tableRef.schemaName}.${tableRef.tableName}] dropped=false (error: ${error instanceof Error ? error.message : String(error)})`,
			)
		}
	}

	console.log(
		`Internal cleanup done: dropped=${internalDroppedCount}, failed=${internalFailedCount}, total=${DRIZZLE_INTERNAL_TABLES.length}`,
	)

	let enumDroppedCount = 0
	let enumFailedCount = 0

	console.log(`Enum types to drop (${ENUM_TYPES_TO_DROP.length}):`)
	for (const enumType of ENUM_TYPES_TO_DROP) {
		console.log(`- ${enumType}`)
	}

	for (const enumType of ENUM_TYPES_TO_DROP) {
		try {
			const enumIdentifier = quoteIdentifier(enumType)
			await db.execute(sql.raw(`DROP TYPE IF EXISTS ${enumIdentifier} CASCADE;`))
			enumDroppedCount += 1
			console.log(`[type ${enumType}] dropped=true`)
		} catch (error) {
			enumFailedCount += 1
			console.error(
				`[type ${enumType}] dropped=false (error: ${error instanceof Error ? error.message : String(error)})`,
			)
		}
	}

	console.log(
		`Enum cleanup done: dropped=${enumDroppedCount}, failed=${enumFailedCount}, total=${ENUM_TYPES_TO_DROP.length}`,
	)
}

try {
	await dropTablesIndividually()
} catch (error) {
	console.error('Failed to drop tables:', error)
	process.exitCode = 1
} finally {
	await pool.end()
}
