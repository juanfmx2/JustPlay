import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  lastname: text('lastname').notNull(),
  phoneNumber: text('phone_number').notNull(),
  email: text('email').notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
