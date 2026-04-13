import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core'

import { divisions } from './division'
import { teams } from './team'
import { courts } from './venue'

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
})

export type GameSet = typeof gameSets.$inferSelect
export type NewGameSet = typeof gameSets.$inferInsert