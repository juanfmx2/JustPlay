import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

import { organizations } from './organization'

export const competitionTypeEnum = pgEnum('competition_type', [
  'SINGLE_DAY',
  'MULTIPLE_DAYS',
  'WEEKLY',
  'MONTHLY',
  'SEASON',
])

export const stageTypeEnum = pgEnum('stage_type', ['REGISTRATION', 'PLAY'])

export const competitions = pgTable('competitions', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: competitionTypeEnum('type').notNull(),
  format: text('format').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  urlSlug: text('url_slug'),
  registrationStageId: integer('registration_stage_id'),
})

export type Competition = typeof competitions.$inferSelect
export type NewCompetition = typeof competitions.$inferInsert

export const stages = pgTable('stages', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id')
    .notNull()
    .references(() => competitions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  urlSlug: text('url_slug'),
  type: stageTypeEnum('type').notNull().default('PLAY'),
})

export type Stage = typeof stages.$inferSelect
export type NewStage = typeof stages.$inferInsert

export const ruleGroups = pgTable('rule_groups', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id')
    .notNull()
    .references(() => competitions.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
})

export type RuleGroup = typeof ruleGroups.$inferSelect
export type NewRuleGroup = typeof ruleGroups.$inferInsert

export const rules = pgTable('rules', {
  id: serial('id').primaryKey(),
  ruleGroupId: integer('rule_group_id')
    .notNull()
    .references(() => ruleGroups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  // HTML is stored as text so rich rules can be rendered later.
  html: text('html').notNull(),
})

export type Rule = typeof rules.$inferSelect
export type NewRule = typeof rules.$inferInsert
