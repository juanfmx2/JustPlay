import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  contactEmail: text('contact_email').notNull(),
})
