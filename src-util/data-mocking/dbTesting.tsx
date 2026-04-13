import { eq, inArray } from 'drizzle-orm'

import { db } from '../../src/db/client'
import { divisions } from '../../src/schema/division'
import { games, gameSets } from '../../src/schema/game'
import { teams } from '../../src/schema/team'
import { courts, venues } from '../../src/schema/venue'

// Unique suffix so repeated runs never clash on url_slug
const run = Date.now()

let venueId: number | undefined
let teamAId: number | undefined
let teamBId: number | undefined
let divisionId: number | undefined

try {
  // ── 1. Insert prerequisites ────────────────────────────────────────────────
  const [venue] = await db
    .insert(venues)
    .values({ name: `Test Venue ${run}` })
    .returning()
  venueId = venue.id

  const [court] = await db
    .insert(courts)
    .values({ venueId: venue.id, name: 'Court 1' })
    .returning()

  const [division] = await db
    .insert(divisions)
    .values({ name: `Test Division ${run}`, level: 'A', type: 'MIXED' })
    .returning()
  divisionId = division.id

  const [teamA, teamB] = await db
    .insert(teams)
    .values([
      { name: 'Team Alpha', urlSlug: `test-team-alpha-${run}` },
      { name: 'Team Beta', urlSlug: `test-team-beta-${run}` },
    ])
    .returning()
  teamAId = teamA.id
  teamBId = teamB.id

  // ── 2. Insert 2 games ──────────────────────────────────────────────────────
  const [game1, game2] = await db
    .insert(games)
    .values([
      { divisionId: division.id, teamAId: teamA.id, teamBId: teamB.id, name: 'Game 1' },
      { divisionId: division.id, teamAId: teamA.id, teamBId: teamB.id, name: 'Game 2' },
    ])
    .returning()

  // ── 3. Insert 3 sets per game ──────────────────────────────────────────────
  await db.insert(gameSets).values([
    { gameId: game1.id, courtId: court.id, name: 'Set 1', scoreTeamA: 25, scoreTeamB: 20 },
    { gameId: game1.id, courtId: court.id, name: 'Set 2', scoreTeamA: 25, scoreTeamB: 18 },
    { gameId: game1.id, courtId: court.id, name: 'Set 3', scoreTeamA: 22, scoreTeamB: 25 },
    { gameId: game2.id, courtId: court.id, name: 'Set 1', scoreTeamA: 18, scoreTeamB: 25 },
    { gameId: game2.id, courtId: court.id, name: 'Set 2', scoreTeamA: 25, scoreTeamB: 23 },
    { gameId: game2.id, courtId: court.id, name: 'Set 3', scoreTeamA: 15, scoreTeamB: 25 },
  ])

  // ── 4. Query all games with their sets ────────────────────────────────────
  const allGames = await db.query.games.findMany({
    with: { gameSets: true },
  })

  console.log('\nGames in the database:')
  console.dir(allGames, { depth: null })
} finally {
  // ── 5. Cleanup (always runs) ───────────────────────────────────────────────
  // games cascade-delete their game_sets
  if (teamAId && teamBId) {
    await db.delete(games).where(
      inArray(games.teamAId, [teamAId, teamBId]),
    )
    await db.delete(teams).where(inArray(teams.id, [teamAId, teamBId]))
  }
  if (divisionId) await db.delete(divisions).where(eq(divisions.id, divisionId))
  // deleting the venue cascades to courts
  if (venueId) await db.delete(venues).where(eq(venues.id, venueId))

  console.log('Cleanup done.')
}
