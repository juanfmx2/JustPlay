import { pgEnum, pgTable, serial, text } from 'drizzle-orm/pg-core'

export const competitionTypeEnum = pgEnum('competition_type', [
  'SINGLE_DAY',
  'MULTIPLE_DAYS',
  'WEEKLY',
  'MONTHLY',
  'SEASON',
])

export const competitions = pgTable('competitions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: competitionTypeEnum('type').notNull(),
  format: text('format').notNull(),
})
