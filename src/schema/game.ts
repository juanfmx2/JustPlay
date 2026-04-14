import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { divisions } from './division'
import { teams } from './team'
import { courts } from './venue'
import type { Team } from './team'
import type { CourtWithVenue } from './venue'

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  divisionId: integer('division_id')
    .notNull()
    .references(() => divisions.id, { onDelete: 'cascade' }),
  teamAId: integer('team_a_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'restrict' }),
  teamBId: integer('team_b_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'restrict' }),
  reffingTeamId: integer('reffing_team_id').references(() => teams.id, {
    onDelete: 'set null',
  }),
  name: text('name'),
  description: text('description'),
  scoreTeamA: integer('score_team_a'),
  scoreTeamB: integer('score_team_b'),
  // if this dates are null then this can be filled from the game set times
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
})

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert

export const gameSets = pgTable('game_sets', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  courtId: integer('court_id')
    .notNull()
    .references(() => courts.id, { onDelete: 'restrict' }),
  name: text('name'),
  description: text('description'),
  scoreTeamA: integer('score_team_a'),
  scoreTeamB: integer('score_team_b'),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
})

export type GameSet = typeof gameSets.$inferSelect
export type NewGameSet = typeof gameSets.$inferInsert

export type GameSetWithCourt = GameSet & {
  court: CourtWithVenue | null
}

export type GameWithTeamsAndSets = Game & {
  teamA: Team
  teamB: Team
  gameSets: GameSetWithCourt[]
}

export type GameWithComputedTimes = Game & {
  effectiveStartTime: Date | null
  effectiveEndTime: Date | null
}

export function withComputedGameFields(game: Game & { gameSets?: GameSet[] }): GameWithComputedTimes {
  const fallbackStart = game.gameSets?.map((s) => s.startTime).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null

  return {
    ...game,
    effectiveStartTime: game.startTime ?? fallbackStart,
    effectiveEndTime: game.endTime ?? fallbackStart,
  }
}
