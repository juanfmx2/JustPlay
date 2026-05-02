import { and, eq, inArray } from 'drizzle-orm'

import { db } from '../../src/db/client'
import { competitions, stages } from '../../src/schema/competition'
import { organizations } from '../../src/schema/organization'
import { standings } from '../../src/schema/standings'

const ORGANIZATION_SLUG = 'cvc'
const COMPETITION_SLUG = 'spring-league-2026'

type AggregateRecord = {
  gamesWon: number
  gamesLost: number
  pointsFor: number
  pointsAgainst: number
  penalties: number
  leaguePoints: number
}

function computeCoefficient(pointsFor: number, pointsAgainst: number): string | null {
  if (pointsAgainst === 0) return null
  return (pointsFor / pointsAgainst).toFixed(4)
}

async function run() {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.urlSlug, ORGANIZATION_SLUG),
  })

  if (!organization) {
    throw new Error(`Organization not found: ${ORGANIZATION_SLUG}`)
  }

  const competition = await db.query.competitions.findFirst({
    where: and(
      eq(competitions.organizationId, organization.id),
      eq(competitions.urlSlug, COMPETITION_SLUG),
    ),
  })

  if (!competition) {
    throw new Error(`Competition not found: ${COMPETITION_SLUG}`)
  }

  if (!competition.registrationStageId) {
    throw new Error(`Competition ${COMPETITION_SLUG} has no registration stage configured.`)
  }

  const registrationStage = await db.query.stages.findFirst({
    where: and(
      eq(stages.id, competition.registrationStageId),
      eq(stages.competitionId, competition.id),
    ),
    with: {
      divisions: {
        with: {
          teams: {
            columns: {
              id: true,
            },
          },
        },
      },
    },
  })

  if (!registrationStage) {
    throw new Error(`Registration stage not found for ${COMPETITION_SLUG}`)
  }

  const registrationTeams = registrationStage.divisions.flatMap((division) =>
    division.teams.map((team) => ({ teamId: team.id, divisionId: division.id })),
  )

  if (registrationTeams.length === 0) {
    throw new Error(`No teams found in registration stage for ${COMPETITION_SLUG}`)
  }

  const registrationDivisionByTeamId = new Map<number, number>(
    registrationTeams.map(({ teamId, divisionId }) => [teamId, divisionId]),
  )

  const playStages = await db.query.stages.findMany({
    where: and(
      eq(stages.competitionId, competition.id),
      eq(stages.type, 'PLAY'),
    ),
    columns: {
      id: true,
    },
  })

  const playStageIds = playStages.map((stage) => stage.id)

  const playStandings =
    playStageIds.length > 0
      ? await db.query.standings.findMany({
          where: inArray(standings.stageId, playStageIds),
        })
      : []

  const aggregates = new Map<number, AggregateRecord>()

  for (const { teamId } of registrationTeams) {
    aggregates.set(teamId, {
      gamesWon: 0,
      gamesLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      penalties: 0,
      leaguePoints: 0,
    })
  }

  for (const row of playStandings) {
    if (!aggregates.has(row.teamId)) {
      continue
    }

    const aggregate = aggregates.get(row.teamId)
    if (!aggregate) {
      continue
    }

    aggregate.gamesWon += row.gamesWon ?? 0
    aggregate.gamesLost += row.gamesLost ?? 0
    aggregate.pointsFor += row.pointsFor ?? 0
    aggregate.pointsAgainst += row.pointsAgainst ?? 0
    aggregate.penalties += row.penalties ?? 0
    aggregate.leaguePoints += row.leaguePoints ?? 0
  }

  await db.delete(standings).where(eq(standings.stageId, registrationStage.id))

  const globalRows = registrationTeams.map(({ teamId }) => {
    const aggregate = aggregates.get(teamId)
    if (!aggregate) {
      throw new Error(`Missing aggregate for team #${teamId}`)
    }

    const divisionId = registrationDivisionByTeamId.get(teamId)
    if (!divisionId) {
      throw new Error(`Missing registration division mapping for team #${teamId}`)
    }

    const coefficient = computeCoefficient(aggregate.pointsFor, aggregate.pointsAgainst)

    return {
      stageId: registrationStage.id,
      divisionId,
      teamId,
      gamesWon: aggregate.gamesWon,
      gamesLost: aggregate.gamesLost,
      pointsFor: aggregate.pointsFor,
      pointsAgainst: aggregate.pointsAgainst,
      coefficient,
      penalties: aggregate.penalties,
      leaguePoints: aggregate.leaguePoints,
      leaguePointsMinusPenalties: aggregate.leaguePoints - aggregate.penalties,
    }
  })

  if (globalRows.length > 0) {
    await db.insert(standings).values(globalRows)
  }

  console.log(
    `Calculated global standings for ${competition.urlSlug}: teams=${globalRows.length}, playStages=${playStageIds.length}, stage=${registrationStage.urlSlug ?? 'registration'}`,
  )
}

await run()
