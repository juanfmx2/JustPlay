import { integer, pgEnum, pgTable, serial, text } from 'drizzle-orm/pg-core'

import { stages } from './competition'
import type { Team } from './team'
import type { GameWithTeamsAndSets } from './game'

export const divisionTypeEnum = pgEnum('division_type', ['MEN', 'WOMEN', 'MIXED'])

export const divisions = pgTable('divisions', {
  id: serial('id').primaryKey(),
  stageId: integer('stage_id').references(() => stages.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  description: text('description'),
  level: text('level').notNull(),
  type: divisionTypeEnum('type').notNull(),
  urlSlug: text('url_slug'),
})

export type Division = typeof divisions.$inferSelect
export type NewDivision = typeof divisions.$inferInsert

export type DivisionWithTeamsGamesAndSets = Division & {
  teams: Team[]
  games: GameWithTeamsAndSets[]
}

export const divisionWithTeamsGamesAndSets = {
  teams: true,
  games: {
    with: {
      teamA: true,
      teamB: true,
      gameSets: {
        with: {
          court: {
            with: {
              venue: true,
            },
          },
        },
      },
    },
  },
} as const
