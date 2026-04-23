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

async function dropAllTables() {
	// First, truncate all data
	await db.execute(sql`
		TRUNCATE TABLE
			game_sets,
			games,
			standings,
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

	console.log('All data truncated.')

	// Then, drop all tables
	await db.execute(sql`
		DROP TABLE IF EXISTS
			game_sets,
			games,
			standings,
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
		CASCADE;
	`)

	console.log('All tables dropped successfully.')
}

try {
	await dropAllTables()
} catch (error) {
	console.error('Failed to drop tables:', error)
	process.exitCode = 1
} finally {
	await pool.end()
}
