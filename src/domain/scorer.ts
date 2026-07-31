import { and, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/db/client'
import { divisions, games, gameSets, stages, standings, type Game } from '@/schema'

type ApplyGameSetScoreInput = {
  gameSetId: number
  scoreTeamA: number
  scoreTeamB: number
}

type TeamStandingSummary = {
  gamesWon: number
  gamesLost: number
  pointsFor: number
  pointsAgainst: number
  coefficient: string | null
  leaguePoints: number
}

type DivisionScoringRules = {
  winnerLeaguePoints: number
  closeLossLeaguePoints: number
  closeLossThreshold: number
  weeklyBonusPoints: number
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

function normalizeDivisionLevel(level: string): string {
  return level.trim().toLowerCase()
}

function getDivisionNumber(level: string): number | null {
	const match = normalizeDivisionLevel(level).match(/\d+/)
	return match ? Number(match[0]) : null
}

function getDivisionScoringRules(level: string, stageUrlSlug: string | null): DivisionScoringRules {
  const numDivsions = 4
  const divNumber = getDivisionNumber(level)
  if (divNumber !== null && (divNumber < 1 || divNumber > numDivsions)) {
      throw new Error(`Invalid division level number: ${level}`)
  }
  const divPower = divNumber !== null ? numDivsions - divNumber + 1 : 1
  return {
      winnerLeaguePoints: 2*divPower,
      closeLossLeaguePoints: Math.floor(1*divPower),
      closeLossThreshold: 10,
      weeklyBonusPoints: 0,
  }
}

function computeTeamStandingSummaryFromGames(
  allGames: Array<{ teamAId: number; teamBId: number; scoreTeamA: number | null; scoreTeamB: number | null }>,
  teamId: number,
  scoringRules: DivisionScoringRules,
): TeamStandingSummary {
  let gamesWon = 0
  let gamesLost = 0
  let pointsFor = 0
  let pointsAgainst = 0
  let leaguePoints = 0

  for (const game of allGames) {
    const scoreA = game.scoreTeamA ?? 0
    const scoreB = game.scoreTeamB ?? 0
    const teamIsA = game.teamAId === teamId

    const teamScore = teamIsA ? scoreA : scoreB
    const opponentScore = teamIsA ? scoreB : scoreA

    pointsFor += teamScore
    pointsAgainst += opponentScore

    if (teamScore > opponentScore) {
      gamesWon += 1
      leaguePoints += scoringRules.winnerLeaguePoints
      continue
    }

    if (teamScore < opponentScore) {
      gamesLost += 1
      if (opponentScore - teamScore <= scoringRules.closeLossThreshold) {
        leaguePoints += scoringRules.closeLossLeaguePoints
      }
    }
  }

  const coefficient = pointsAgainst === 0 ? null : (pointsFor / pointsAgainst).toFixed(4)

  return { gamesWon, gamesLost, pointsFor, pointsAgainst, coefficient, leaguePoints }
}

async function recalculateStandingsForStageInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  stageId: number,
): Promise<void> {
  const stage = await tx.query.stages.findFirst({
    where: eq(stages.id, stageId),
  })

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
    })

    const divStandings = await tx.query.standings.findMany({
      where: and(
        eq(standings.stageId, stageId),
        eq(standings.divisionId, div.id),
      ),
    })

    const scoringRules = getDivisionScoringRules(div.level, stage?.urlSlug ?? null)

    // Compute every team's summary first (without the weekly bonus)
    const teamSummaries = divStandings.map((row) => {
      const teamGames = divGames.filter(
        (g) => g.teamAId === row.teamId || g.teamBId === row.teamId,
      )
      const summary = computeTeamStandingSummaryFromGames(teamGames, row.teamId, scoringRules)
      return { row, summary }
    })

    // Determine the team being demoted (lowest league points) so we can
    // exclude it from the Division 1 survival bonus.
    let demotedTeamId: number | null = null
    if (scoringRules.weeklyBonusPoints > 0 && teamSummaries.length > 0) {
      const minPoints = Math.min(...teamSummaries.map((t) => t.summary.leaguePoints))
      const demoted = teamSummaries.find((t) => t.summary.leaguePoints === minPoints)
      demotedTeamId = demoted?.row.teamId ?? null
    }

    for (const { row, summary } of teamSummaries) {
      const survivorBonus =
        scoringRules.weeklyBonusPoints > 0 && row.teamId !== demotedTeamId
          ? scoringRules.weeklyBonusPoints
          : 0
      const totalLeaguePoints = summary.leaguePoints + survivorBonus
      const penalties = row.penalties ?? 0
      const leaguePointsMinusPenalties =
        penalties === 0 ? totalLeaguePoints : totalLeaguePoints - penalties

      await tx
        .update(standings)
        .set({
          gamesWon: summary.gamesWon,
          gamesLost: summary.gamesLost,
          pointsFor: summary.pointsFor,
          pointsAgainst: summary.pointsAgainst,
          coefficient: summary.coefficient,
          leaguePoints: totalLeaguePoints,
          leaguePointsMinusPenalties,
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
