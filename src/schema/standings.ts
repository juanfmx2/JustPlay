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
    setsFor: integer('sets_for'),
    setsAgainst: integer('sets_against'),
    setsCoefficient: numeric('sets_coefficient', { precision: 10, scale: 4 }),
    pointsFor: integer('points_for'),
    pointsAgainst: integer('points_against'),
    coefficient: numeric('coefficient', { precision: 10, scale: 4 }),
    penalties: integer('penalties'),
    leaguePoints: integer('league_points'),
    leaguePointsMinusPenalties: integer('league_points_minus_penalties'),
    // Manual tie-break awarded by an admin (e.g. after a coin toss).
    adminBonusPoints: integer('admin_bonus_points'),
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
