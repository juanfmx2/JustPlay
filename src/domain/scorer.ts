import { and, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/db/client'
import { divisions, games, gameSets, standings } from '@/schema'

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

function assertValidScore(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
}

function isDivisionOne(level: string): boolean {
  const normalized = level.trim().toLowerCase()
  return normalized === '1' || normalized === 'div 1' || normalized === 'division 1'
}

function computeTeamStandingSummaryFromGames(
  allGames: Array<{ teamAId: number; teamBId: number; scoreTeamA: number | null; scoreTeamB: number | null }>,
  teamId: number,
  winnerLeaguePoints: number,
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
      leaguePoints += winnerLeaguePoints
      continue
    }

    if (teamScore < opponentScore) {
      gamesLost += 1
      if (opponentScore - teamScore <= 10) {
        leaguePoints += 1
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

    const winnerLeaguePoints = isDivisionOne(div.level) ? 3 : 2

    for (const row of divStandings) {
      const teamGames = divGames.filter(
        (g) => g.teamAId === row.teamId || g.teamBId === row.teamId,
      )

      const summary = computeTeamStandingSummaryFromGames(teamGames, row.teamId, winnerLeaguePoints)
      const penalties = row.penalties ?? 0
      const leaguePointsMinusPenalties =
        penalties === 0 ? summary.leaguePoints : summary.leaguePoints - penalties

      await tx
        .update(standings)
        .set({
          gamesWon: summary.gamesWon,
          gamesLost: summary.gamesLost,
          pointsFor: summary.pointsFor,
          pointsAgainst: summary.pointsAgainst,
          coefficient: summary.coefficient,
          leaguePoints: summary.leaguePoints,
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

    // 2. Persist the new score on the game set and parent game
    await tx
      .update(gameSets)
      .set({ scoreTeamA: input.scoreTeamA, scoreTeamB: input.scoreTeamB, lastUpdated: new Date() })
      .where(eq(gameSets.id, input.gameSetId))

    await tx
      .update(games)
      .set({ scoreTeamA: input.scoreTeamA, scoreTeamB: input.scoreTeamB })
      .where(eq(games.id, game.id))

    await recalculateStandingsForStageInTx(tx, stageId)
  })
}
