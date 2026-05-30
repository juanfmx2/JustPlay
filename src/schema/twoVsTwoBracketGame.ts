import { integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { players } from './player'

export const twoVsTwoBracketGames = pgTable(
  'two_vs_two_bracket_games',
  {
    id: serial('id').primaryKey(),
    pool: text('pool').notNull(),
    matchKey: text('match_key').notNull(),
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
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    poolMatchUnique: unique().on(table.pool, table.matchKey),
  }),
)

export type TwoVsTwoBracketGame = typeof twoVsTwoBracketGames.$inferSelect
export type NewTwoVsTwoBracketGame = typeof twoVsTwoBracketGames.$inferInsert
