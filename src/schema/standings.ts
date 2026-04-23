import { integer, numeric, pgTable, serial, uniqueIndex } from 'drizzle-orm/pg-core'

import { stages } from './competition'
import { divisions } from './division'
import { teams } from './team'

export const standings = pgTable(
  'standings',
  {
    id: serial('id').primaryKey(),
    stageId: integer('stage_id')
      .notNull()
      .references(() => stages.id, { onDelete: 'cascade' }),
    divisionId: integer('division_id')
      .notNull()
      .references(() => divisions.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    gamesWon: integer('games_won'),
    gamesLost: integer('games_lost'),
    pointsFor: integer('points_for'),
    pointsAgainst: integer('points_against'),
    coefficient: numeric('coefficient', { precision: 10, scale: 4 }),
    penalties: integer('penalties'),
    leaguePoints: integer('league_points'),
    leaguePointsMinusPenalties: integer('league_points_minus_penalties'),
  },
  (table) => [
    uniqueIndex('standings_stage_division_team_uidx').on(
      table.stageId,
      table.divisionId,
      table.teamId,
    ),
  ],
)

export type Standing = typeof standings.$inferSelect
export type NewStanding = typeof standings.$inferInsert
