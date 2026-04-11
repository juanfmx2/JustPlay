import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  urlSlug: text('url_slug').notNull().unique(),
})
