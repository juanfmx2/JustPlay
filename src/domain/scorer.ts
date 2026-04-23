import { and, eq, isNotNull, or } from 'drizzle-orm'

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

async function computeTeamStandingSummary(
  divisionId: number,
  teamId: number,
  winnerLeaguePoints: number,
): Promise<TeamStandingSummary> {
  const teamGames = await db.query.games.findMany({
    where: and(
      eq(games.divisionId, divisionId),
      or(eq(games.teamAId, teamId), eq(games.teamBId, teamId)),
      isNotNull(games.scoreTeamA),
      isNotNull(games.scoreTeamB),
    ),
  })

  let gamesWon = 0
  let gamesLost = 0
  let pointsFor = 0
  let pointsAgainst = 0
  let leaguePoints = 0

  for (const game of teamGames) {
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

  return {
    gamesWon,
    gamesLost,
    pointsFor,
    pointsAgainst,
    coefficient,
    leaguePoints,
  }
}

export async function applyGameSetScoreAndUpdateStandings(
  input: ApplyGameSetScoreInput,
): Promise<void> {
  assertValidScore(input.scoreTeamA, 'scoreTeamA')
  assertValidScore(input.scoreTeamB, 'scoreTeamB')

  await db.transaction(async (tx) => {
    const gameSet = await tx.query.gameSets.findFirst({
      where: eq(gameSets.id, input.gameSetId),
    })

    if (!gameSet) {
      throw new Error(`Game set #${input.gameSetId} was not found.`)
    }

    const game = await tx.query.games.findFirst({
      where: eq(games.id, gameSet.gameId),
    })

    if (!game) {
      throw new Error(`Game #${gameSet.gameId} was not found for game set #${input.gameSetId}.`)
    }

    const division = await tx.query.divisions.findFirst({
      where: eq(divisions.id, game.divisionId),
    })

    if (!division?.stageId) {
      throw new Error(`Division #${game.divisionId} was not found or has no stage assigned.`)
    }

    await tx
      .update(gameSets)
      .set({
        scoreTeamA: input.scoreTeamA,
        scoreTeamB: input.scoreTeamB,
      })
      .where(eq(gameSets.id, input.gameSetId))

    // Keep the parent game score in sync with this submitted game-set score.
    await tx
      .update(games)
      .set({
        scoreTeamA: input.scoreTeamA,
        scoreTeamB: input.scoreTeamB,
      })
      .where(eq(games.id, game.id))

    const winnerLeaguePoints = isDivisionOne(division.level) ? 3 : 2
    const affectedTeamIds = [game.teamAId, game.teamBId]

    for (const teamId of affectedTeamIds) {
      const summary = await computeTeamStandingSummary(division.id, teamId, winnerLeaguePoints)

      const standing = await tx.query.standings.findFirst({
        where: and(
          eq(standings.stageId, division.stageId),
          eq(standings.divisionId, division.id),
          eq(standings.teamId, teamId),
        ),
      })

      if (!standing) {
        throw new Error(
          `Standing row not found for team #${teamId} in stage #${division.stageId} and division #${division.id}.`,
        )
      }

      const penalties = standing.penalties ?? 0
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
        .where(eq(standings.id, standing.id))
    }
  })
}
