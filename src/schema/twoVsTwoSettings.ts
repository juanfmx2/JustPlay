import { boolean, integer, pgTable, timestamp } from 'drizzle-orm/pg-core'

export const twoVsTwoSettings = pgTable('two_vs_two_settings', {
  id: integer('id').primaryKey(),
  registerGamesEnabled: boolean('register_games_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TwoVsTwoSettings = typeof twoVsTwoSettings.$inferSelect
export type NewTwoVsTwoSettings = typeof twoVsTwoSettings.$inferInsert
