import { pgEnum, pgTable, serial, text } from 'drizzle-orm/pg-core'

export const divisionTypeEnum = pgEnum('division_type', ['MEN', 'WOMEN', 'MIXED'])

export const divisions = pgTable('divisions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  level: text('level').notNull(),
  type: divisionTypeEnum('type').notNull(),
})
