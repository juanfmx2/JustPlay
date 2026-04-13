import { relations } from 'drizzle-orm'

import { addresses } from './address'
import { competitions, ruleGroups, rules, stages } from './competition'
import { divisions } from './division'
import { games, gameSets } from './game'
import { organizations } from './organization'
import { teams } from './team'
import { courts, venueBookings, venues } from './venue'

export const addressesRelations = relations(addresses, ({ many }) => ({
  venues: many(venues),
}))

export const organizationsRelations = relations(organizations, ({ many }) => ({
  competitions: many(competitions),
}))

export const competitionsRelations = relations(competitions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [competitions.organizationId],
    references: [organizations.id],
  }),
  stages: many(stages),
  ruleGroups: many(ruleGroups),
  venueBookings: many(venueBookings),
}))

export const ruleGroupsRelations = relations(ruleGroups, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [ruleGroups.competitionId],
    references: [competitions.id],
  }),
  rules: many(rules),
}))

export const rulesRelations = relations(rules, ({ one }) => ({
  ruleGroup: one(ruleGroups, {
    fields: [rules.ruleGroupId],
    references: [ruleGroups.id],
  }),
}))

export const stagesRelations = relations(stages, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [stages.competitionId],
    references: [competitions.id],
  }),
  divisions: many(divisions),
}))

export const divisionsRelations = relations(divisions, ({ one, many }) => ({
  stage: one(stages, {
    fields: [divisions.stageId],
    references: [stages.id],
  }),
  teams: many(teams),
  games: many(games),
}))

export const teamsRelations = relations(teams, ({ one, many }) => ({
  division: one(divisions, {
    fields: [teams.divisionId],
    references: [divisions.id],
  }),
  gamesAsTeamA: many(games, { relationName: 'team_a' }),
  gamesAsTeamB: many(games, { relationName: 'team_b' }),
  gamesAsReffing: many(games, { relationName: 'reffing_team' }),
}))

export const gamesRelations = relations(games, ({ one, many }) => ({
  division: one(divisions, {
    fields: [games.divisionId],
    references: [divisions.id],
  }),
  teamA: one(teams, {
    fields: [games.teamAId],
    references: [teams.id],
    relationName: 'team_a',
  }),
  teamB: one(teams, {
    fields: [games.teamBId],
    references: [teams.id],
    relationName: 'team_b',
  }),
  reffingTeam: one(teams, {
    fields: [games.reffingTeamId],
    references: [teams.id],
    relationName: 'reffing_team',
  }),
  gameSets: many(gameSets),
}))

export const gameSetsRelations = relations(gameSets, ({ one }) => ({
  game: one(games, {
    fields: [gameSets.gameId],
    references: [games.id],
  }),
  court: one(courts, {
    fields: [gameSets.courtId],
    references: [courts.id],
  }),
}))

export const venuesRelations = relations(venues, ({ one, many }) => ({
  address: one(addresses, {
    fields: [venues.addressId],
    references: [addresses.id],
  }),
  courts: many(courts),
  venueBookings: many(venueBookings),
}))

export const venueBookingsRelations = relations(venueBookings, ({ one }) => ({
  competition: one(competitions, {
    fields: [venueBookings.competitionId],
    references: [competitions.id],
  }),
  venue: one(venues, {
    fields: [venueBookings.venueId],
    references: [venues.id],
  }),
}))

export const courtsRelations = relations(courts, ({ one, many }) => ({
  venue: one(venues, {
    fields: [courts.venueId],
    references: [venues.id],
  }),
  gameSets: many(gameSets),
}))
