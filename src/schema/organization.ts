import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  urlSlug: text('url_slug').notNull().unique(),
  description: text('description').notNull(),
  contactEmail: text('contact_email').notNull(),
})

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
