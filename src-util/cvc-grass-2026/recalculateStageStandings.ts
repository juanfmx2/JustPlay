import 'dotenv/config'
import { and, eq, isNotNull } from 'drizzle-orm'

import { db } from '../../src/db/client'
import { competitions, stages } from '../../src/schema/competition'
import { divisions } from '../../src/schema/division'
import { games } from '../../src/schema/game'
import { standings } from '../../src/schema/standings'

const COMPETITION_SLUG = 'cvc-grass-2026'

type ScoredSet = {
  id: number
  scoreTeamA: number | null
  scoreTeamB: number | null
  startTime: Date | null
}

type MatchGame = {
  teamAId: number
  teamBId: number
  scoreTeamA: number | null
  scoreTeamB: number | null
  gameSets: ScoredSet[]
}

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

function computeMatchProgress<T extends ScoredSet>(sets: T[]): { isComplete: boolean; relevantSets: T[] } {
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

function computeTeamStandingSummaryFromGames(allGames: MatchGame[], teamId: number): TeamStandingSummary {
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

    const progress = computeMatchProgress(game.gameSets)
    let teamSetWins = 0
    let opponentSetWins = 0

    for (const set of progress.relevantSets) {
      const winner = setWinner(set)
      if (!winner) continue

      const teamWonSet = (winner === 'A') === teamIsA
      if (teamWonSet) {
        setsFor += 1
        teamSetWins += 1
      } else {
        setsAgainst += 1
        opponentSetWins += 1
      }
    }

    if (progress.isComplete) {
      if (teamSetWins > opponentSetWins) gamesWon += 1
      else if (teamSetWins < opponentSetWins) gamesLost += 1
    }
  }

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

async function recalculateStageStandings(stageId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const stageDivisions = await tx.query.divisions.findMany({
      where: eq(divisions.stageId, stageId),
    })

    for (const division of stageDivisions) {
      const divisionGames = await tx.query.games.findMany({
        where: and(
          eq(games.divisionId, division.id),
          isNotNull(games.scoreTeamA),
          isNotNull(games.scoreTeamB),
        ),
        with: { gameSets: true },
      })

      const divisionStandings = await tx.query.standings.findMany({
        where: and(
          eq(standings.stageId, stageId),
          eq(standings.divisionId, division.id),
        ),
      })

      for (const row of divisionStandings) {
        const summary = computeTeamStandingSummaryFromGames(divisionGames, row.teamId)

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
  })
}

async function main() {
  const stageUrlSlug = process.argv[2]
  if (!stageUrlSlug) {
    throw new Error('Usage: pnpm calc:standings-cvc-grass-2026 <stage_url_slug>')
  }

  const competition = await db.query.competitions.findFirst({
    where: eq(competitions.urlSlug, COMPETITION_SLUG),
  })

  if (!competition) {
    throw new Error(`Competition not found for slug: ${COMPETITION_SLUG}`)
  }

  const stage = await db.query.stages.findFirst({
    where: and(
      eq(stages.competitionId, competition.id),
      eq(stages.urlSlug, stageUrlSlug),
    ),
  })

  if (!stage) {
    const availableStages = await db.query.stages.findMany({
      where: eq(stages.competitionId, competition.id),
    })

    const availableStageSlugs = availableStages
      .map((row) => row.urlSlug)
      .filter((slug): slug is string => Boolean(slug))

    throw new Error(
      `Stage not found for slug: ${stageUrlSlug}. Available slugs: ${availableStageSlugs.join(', ') || '(none)'}`,
    )
  }

  await recalculateStageStandings(stage.id)
  console.log(`Standings recalculated for ${COMPETITION_SLUG} stage: ${stage.urlSlug ?? stage.id}`)
}

main().catch((error) => {
  console.error('Failed to recalculate standings:', error)
  process.exitCode = 1
})
