import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core'

import { divisions } from './division'

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  divisionId: integer('division_id').references(() => divisions.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  description: text('description'),
  urlSlug: text('url_slug').notNull().unique(),
})

export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
