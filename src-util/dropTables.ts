import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is required to connect to PostgreSQL.')
}

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
})

const db = drizzle(pool)
const APPLICATION_SCHEMAS = ['drizzle', 'public'] as const

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replace(/"/g, '""')}"`
}

async function resetDatabaseSchemas() {
	console.log(`Resetting schemas (${APPLICATION_SCHEMAS.length}):`)
	for (const schemaName of APPLICATION_SCHEMAS) {
		console.log(`- ${schemaName}`)
	}

	await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${quoteIdentifier('drizzle')} CASCADE;`))
	console.log('[drizzle] dropped=true')

	await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${quoteIdentifier('public')} CASCADE;`))
	console.log('[public] dropped=true')

	await db.execute(sql.raw(`CREATE SCHEMA ${quoteIdentifier('public')};`))
	await db.execute(sql.raw(`GRANT ALL ON SCHEMA ${quoteIdentifier('public')} TO PUBLIC;`))
	await db.execute(sql.raw(`GRANT ALL ON SCHEMA ${quoteIdentifier('public')} TO CURRENT_USER;`))
	console.log('[public] recreated=true')

	console.log('Database reset complete: public recreated, drizzle removed, all tables/types/sequences cleared.')
}

try {
	await resetDatabaseSchemas()
} catch (error) {
	console.error('Failed to drop tables:', error)
	process.exitCode = 1
} finally {
	await pool.end()
}
