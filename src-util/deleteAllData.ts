import 'dotenv/config'
import { sql } from 'drizzle-orm'
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

async function deleteAllData() {
	await db.execute(sql`
		TRUNCATE TABLE
			game_sets,
			games,
			teams,
			divisions,
			stages,
			competitions,
			courts,
			venue_bookings,
			venues,
			addresses,
			organizations,
			users
		RESTART IDENTITY CASCADE;
	`)

	console.log('All database data deleted successfully.')
}

try {
	await deleteAllData()
} catch (error) {
	console.error('Failed to delete database data:', error)
	process.exitCode = 1
} finally {
	await pool.end()
}
