import { integer, numeric, pgTable, serial, text } from 'drizzle-orm/pg-core'

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  ranking: integer('ranking').notNull().default(500),
  pointsFor: integer('points_for').notNull().default(0),
  pointsAgainst: integer('points_against').notNull().default(0),
  coefficient: numeric('coefficient', { precision: 10, scale: 4 }),
})

export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
