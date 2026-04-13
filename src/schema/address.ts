import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  street: text('street'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
})

export type Address = typeof addresses.$inferSelect
export type NewAddress = typeof addresses.$inferInsert