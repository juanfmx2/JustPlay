import { and, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/db/client'
import { divisions, games, gameSets, standings, type Game, type Standing } from '@/schema'

type ApplyGameSetScoreInput = {
  gameSetId: number
  scoreTeamA: number
  scoreTeamB: number
}

// Scoring rules (data/rules.json, "All Matches"):
// - League points: 1 point per set won, 0 for a set lost.
// - Ties broken by: sets coefficient, then points coefficient, then points for.
type TeamStandingSummary = {
  gamesWon: number
  gamesLost: number
  setsFor: number
  setsAgainst: number
  setsCoefficient: string | null
  pointsFor: number
  pointsAgainst: number
  coefficient: string | null
  leaguePoints: number
}

function assertValidScore(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
}

type ScoredSet = {
  id: number
  scoreTeamA: number | null
  scoreTeamB: number | null
  startTime: Date | null
}

function orderSets<T extends ScoredSet>(sets: T[]): T[] {
  return [...sets].sort((a, b) => {
    const timeA = a.startTime ? a.startTime.getTime() : Number.MAX_SAFE_INTEGER
    const timeB = b.startTime ? b.startTime.getTime() : Number.MAX_SAFE_INTEGER
    if (timeA !== timeB) return timeA - timeB
    return a.id - b.id
  })
}

function setWinner(set: ScoredSet): 'A' | 'B' | null {
  if (set.scoreTeamA === null || set.scoreTeamB === null) return null
  if (set.scoreTeamA > set.scoreTeamB) return 'A'
  if (set.scoreTeamB > set.scoreTeamA) return 'B'
  return null
}

type MatchProgress<T> = {
  // A game is complete once one team has won 2 sets: either sets 1-2 both
  // went the same way, or the series is split 1-1 and a 3rd/decider set
  // has been played.
  isComplete: boolean
  relevantSets: T[]
}

function computeMatchProgress<T extends ScoredSet>(sets: T[]): MatchProgress<T> {
  const [set1, set2, set3] = orderSets(sets)

  const winner1 = set1 ? setWinner(set1) : null
  const winner2 = set2 ? setWinner(set2) : null

  if (winner1 && winner2 && winner1 === winner2) {
    return { isComplete: true, relevantSets: [set1, set2] }
  }

  if (!winner1 || !winner2) {
    return { isComplete: false, relevantSets: [set1, set2].filter((set): set is T => Boolean(set)) }
  }

  const winner3 = set3 ? setWinner(set3) : null
  if (!winner3) {
    return { isComplete: false, relevantSets: [set1, set2, set3].filter((set): set is T => Boolean(set)) }
  }

  return { isComplete: true, relevantSets: [set1, set2, set3] }
}

function ratioToFixed(numerator: number, denominator: number): string | null {
  if (denominator === 0) return null
  return (numerator / denominator).toFixed(4)
}

function computeTeamStandingSummaryFromGames(
  allGames: Array<Game & { gameSets: ScoredSet[] }>,
  teamId: number,
): TeamStandingSummary {
  let gamesWon = 0
  let gamesLost = 0
  let setsFor = 0
  let setsAgainst = 0
  let pointsFor = 0
  let pointsAgainst = 0

  for (const game of allGames) {
    if (game.teamAId !== teamId && game.teamBId !== teamId) continue

    const teamIsA = game.teamAId === teamId
    const scoreA = game.scoreTeamA ?? 0
    const scoreB = game.scoreTeamB ?? 0
    const teamScore = teamIsA ? scoreA : scoreB
    const opponentScore = teamIsA ? scoreB : scoreA

    pointsFor += teamScore
    pointsAgainst += opponentScore
    if (teamScore > opponentScore) gamesWon += 1
    else if (teamScore < opponentScore) gamesLost += 1

    const progress = computeMatchProgress(game.gameSets)
    for (const set of progress.relevantSets) {
      const winner = setWinner(set)
      if (!winner) continue
      const teamWonSet = (winner === 'A') === teamIsA
      if (teamWonSet) setsFor += 1
      else setsAgainst += 1
    }
  }

  // League points: 1 point per set won, 0 for a set lost (data/rules.json).
  const leaguePoints = setsFor

  return {
    gamesWon,
    gamesLost,
    setsFor,
    setsAgainst,
    setsCoefficient: ratioToFixed(setsFor, setsAgainst),
    pointsFor,
    pointsAgainst,
    coefficient: ratioToFixed(pointsFor, pointsAgainst),
    leaguePoints,
  }
}

async function recalculateStandingsForStageInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  stageId: number,
): Promise<void> {
  const stageDivisions = await tx.query.divisions.findMany({
    where: eq(divisions.stageId, stageId),
  })

  for (const div of stageDivisions) {
    const divGames = await tx.query.games.findMany({
      where: and(
        eq(games.divisionId, div.id),
        isNotNull(games.scoreTeamA),
        isNotNull(games.scoreTeamB),
      ),
      with: { gameSets: true },
    })

    const divStandings = await tx.query.standings.findMany({
      where: and(
        eq(standings.stageId, stageId),
        eq(standings.divisionId, div.id),
      ),
    })

    for (const row of divStandings) {
      const summary = computeTeamStandingSummaryFromGames(divGames, row.teamId)

      await tx
        .update(standings)
        .set({
          gamesWon: summary.gamesWon,
          gamesLost: summary.gamesLost,
          setsFor: summary.setsFor,
          setsAgainst: summary.setsAgainst,
          setsCoefficient: summary.setsCoefficient,
          pointsFor: summary.pointsFor,
          pointsAgainst: summary.pointsAgainst,
          coefficient: summary.coefficient,
          leaguePoints: summary.leaguePoints,
        })
        .where(eq(standings.id, row.id))
    }
  }
}

export async function recalculateStandingsForStage(stageId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await recalculateStandingsForStageInTx(tx, stageId)
  })
}

export async function applyGameSetScoreAndUpdateStandings(
  input: ApplyGameSetScoreInput,
): Promise<void> {
  assertValidScore(input.scoreTeamA, 'scoreTeamA')
  assertValidScore(input.scoreTeamB, 'scoreTeamB')

  await db.transaction(async (tx) => {
    // 1. Resolve game set → game → division → stage
    const gameSet = await tx.query.gameSets.findFirst({
      where: eq(gameSets.id, input.gameSetId),
    })
    if (!gameSet) throw new Error(`Game set #${input.gameSetId} was not found.`)

    const game = await tx.query.games.findFirst({
      where: eq(games.id, gameSet.gameId),
    })
    if (!game) throw new Error(`Game #${gameSet.gameId} was not found for game set #${input.gameSetId}.`)

    const division = await tx.query.divisions.findFirst({
      where: eq(divisions.id, game.divisionId),
    })
    if (!division?.stageId) {
      throw new Error(`Division #${game.divisionId} was not found or has no stage assigned.`)
    }

    const stageId = division.stageId

    // 2. Persist the new score only on the targeted game set.
    await tx
      .update(gameSets)
      .set({ scoreTeamA: input.scoreTeamA, scoreTeamB: input.scoreTeamB, lastUpdated: new Date() })
      .where(eq(gameSets.id, input.gameSetId))

    // 3. Recompute parent game totals from this game's sets only.
    const allSetsForGame = await tx.query.gameSets.findMany({
      where: eq(gameSets.gameId, game.id),
    })

    const progress = computeMatchProgress(allSetsForGame)

    const gameTotalScoreTeamA = progress.isComplete
      ? progress.relevantSets.reduce((sum, set) => sum + (set.scoreTeamA ?? 0), 0)
      : null
    const gameTotalScoreTeamB = progress.isComplete
      ? progress.relevantSets.reduce((sum, set) => sum + (set.scoreTeamB ?? 0), 0)
      : null

    await tx
      .update(games)
      .set({
        scoreTeamA: gameTotalScoreTeamA,
        scoreTeamB: gameTotalScoreTeamB,
        // Editing a score after the game was finished invalidates any
        // approvals/validation already recorded against the old score.
        ...(game.finishedAt
          ? {
              finishedAt: null,
              teamAApprovedAt: null,
              teamBApprovedAt: null,
              adminValidatedAt: null,
              adminValidatedByName: null,
            }
          : {}),
      })
      .where(eq(games.id, game.id))

    // 4. Refresh standings for the stage.
    await recalculateStandingsForStageInTx(tx, stageId)
  })
}

export async function finishGame(gameId: number): Promise<Game> {
  return db.transaction(async (tx) => {
    const game = await tx.query.games.findFirst({ where: eq(games.id, gameId) })
    if (!game) throw new Error(`Game #${gameId} was not found.`)

    const allSetsForGame = await tx.query.gameSets.findMany({
      where: eq(gameSets.gameId, gameId),
    })
    const progress = computeMatchProgress(allSetsForGame)

    if (!progress.isComplete) {
      throw new Error('A team must win at least 2 sets before the game can be finished.')
    }

    const [updated] = await tx
      .update(games)
      .set({ finishedAt: new Date() })
      .where(eq(games.id, gameId))
      .returning()

    return updated
  })
}

export async function approveGameForTeam(gameId: number, teamSide: 'A' | 'B'): Promise<Game> {
  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) })
  if (!game) throw new Error(`Game #${gameId} was not found.`)
  if (!game.finishedAt) throw new Error('The game must be finished before it can be approved.')

  const [updated] = await db
    .update(games)
    .set(teamSide === 'A' ? { teamAApprovedAt: new Date() } : { teamBApprovedAt: new Date() })
    .where(eq(games.id, gameId))
    .returning()

  return updated
}

export async function validateGameByAdmin(gameId: number, adminName: string): Promise<Game> {
  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) })
  if (!game) throw new Error(`Game #${gameId} was not found.`)
  if (!game.finishedAt) throw new Error('The game must be finished before it can be validated.')

  const [updated] = await db
    .update(games)
    .set({ adminValidatedAt: new Date(), adminValidatedByName: adminName })
    .where(eq(games.id, gameId))
    .returning()

  return updated
}

// Manual coin-toss resolution: an admin awards (or revokes) a single bonus
// point to a team's standings row. This is the final tie-breaker, applied
// only after league points, sets coefficient, points coefficient, and points
// for have all been compared and are still equal (data/rules.json).
export async function setStandingAdminBonus(standingId: number, bonusPoints: number): Promise<Standing> {
  if (!Number.isInteger(bonusPoints) || bonusPoints < 0) {
    throw new Error('bonusPoints must be a non-negative integer.')
  }

  const [updated] = await db
    .update(standings)
    .set({ adminBonusPoints: bonusPoints })
    .where(eq(standings.id, standingId))
    .returning()

  if (!updated) throw new Error(`Standing #${standingId} was not found.`)

  return updated
}
