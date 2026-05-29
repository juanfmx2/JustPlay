import { integer, pgTable, serial, timestamp } from 'drizzle-orm/pg-core'

import { players } from './player'

export const twoVsTwoGames = pgTable('two_vs_two_games', {
  id: serial('id').primaryKey(),
  teamAPlayer1Id: integer('team_a_player_1_id')
    .notNull()
    .references(() => players.id),
  teamAPlayer2Id: integer('team_a_player_2_id')
    .notNull()
    .references(() => players.id),
  teamBPlayer1Id: integer('team_b_player_1_id')
    .notNull()
    .references(() => players.id),
  teamBPlayer2Id: integer('team_b_player_2_id')
    .notNull()
    .references(() => players.id),
  scoreTeamA: integer('score_team_a').notNull(),
  scoreTeamB: integer('score_team_b').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TwoVsTwoGame = typeof twoVsTwoGames.$inferSelect
export type NewTwoVsTwoGame = typeof twoVsTwoGames.$inferInsert
