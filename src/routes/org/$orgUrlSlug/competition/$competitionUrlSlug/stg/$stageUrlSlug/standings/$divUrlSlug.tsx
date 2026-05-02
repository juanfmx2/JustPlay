import { and, eq } from 'drizzle-orm'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '@/db/client'
import {
  competitions,
  divisions,
  organizations,
  stages,
  standings,
  type Competition,
  type Division,
  type Organization,
  type Stage,
} from '@/schema'
import { StandingsTable, type StandingRow } from '@/components/StandingsTable'
import { StandingsConventions } from '@/components/StandingsConventions'

type LoaderData = {
  organization: Organization | null
  competition: Competition | null
  stage: Stage | null
  division: Division | null
  standingsRows: StandingRow[]
}

const loadDivisionStandings = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: {
      orgUrlSlug: string
      competitionUrlSlug: string
      stageUrlSlug: string
      divUrlSlug: string
    }) => input,
  )
  .handler(async ({ data }): Promise<LoaderData> => {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })

    if (!organization) {
      return {
        organization: null,
        competition: null,
        stage: null,
        division: null,
        standingsRows: [],
      }
    }

    const competition = await db.query.competitions.findFirst({
      where: and(
        eq(competitions.organizationId, organization.id),
        eq(competitions.urlSlug, data.competitionUrlSlug),
      ),
    })

    if (!competition) {
      return {
        organization,
        competition: null,
        stage: null,
        division: null,
        standingsRows: [],
      }
    }

    const stage = await db.query.stages.findFirst({
      where: and(
        eq(stages.competitionId, competition.id),
        eq(stages.urlSlug, data.stageUrlSlug),
      ),
    })

    if (!stage) {
      return {
        organization,
        competition,
        stage: null,
        division: null,
        standingsRows: [],
      }
    }

    const division = await db.query.divisions.findFirst({
      where: and(eq(divisions.stageId, stage.id), eq(divisions.urlSlug, data.divUrlSlug)),
    })

    if (!division) {
      return {
        organization,
        competition,
        stage,
        division: null,
        standingsRows: [],
      }
    }

    const standingsWithTeams = await db.query.standings.findMany({
      where: and(eq(standings.stageId, stage.id), eq(standings.divisionId, division.id)),
      with: {
        team: true,
      },
    })

    const standingsRows = standingsWithTeams
      .map((row) => ({
        id: row.id,
        teamId: row.teamId,
        teamName: row.team?.name ?? `Team #${row.teamId}`,
        gamesWon: row.gamesWon,
        gamesLost: row.gamesLost,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        coefficient: row.coefficient,
        penalties: row.penalties,
        leaguePoints: row.leaguePoints,
        leaguePointsMinusPenalties: row.leaguePointsMinusPenalties,
      }))
      .sort((a, b) => {
        const gwA = a.gamesWon ?? Number.NEGATIVE_INFINITY
        const gwB = b.gamesWon ?? Number.NEGATIVE_INFINITY
        if (gwB !== gwA) return gwB - gwA

        const coefA = a.coefficient === null ? Number.NEGATIVE_INFINITY : Number(a.coefficient)
        const coefB = b.coefficient === null ? Number.NEGATIVE_INFINITY : Number(b.coefficient)
        if (coefB !== coefA) return coefB - coefA

        return a.teamName.localeCompare(b.teamName)
      })

    return {
      organization,
      competition,
      stage,
      division,
      standingsRows,
    }
  })

export const Route = createFileRoute('/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/standings/$divUrlSlug')({
  loader: async ({ params }) =>
    loadDivisionStandings({
      data: {
        orgUrlSlug: params.orgUrlSlug,
        competitionUrlSlug: params.competitionUrlSlug,
        stageUrlSlug: params.stageUrlSlug,
        divUrlSlug: params.divUrlSlug,
      },
    }),
  component: DivisionStandingsPage,
})

function DivisionStandingsPage() {
  const data = Route.useLoaderData()

  const divNum = parseInt((data.division?.level ?? '').replace(/[^0-9]/g, ''), 10)

  if (!data.organization) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Organization not found</h1>
        <p className="text-body-secondary mb-0">No organization exists for this slug.</p>
      </section>
    )
  }

  if (!data.competition) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Competition not found</h1>
        <p className="text-body-secondary mb-0">No competition exists for this slug in this organization.</p>
      </section>
    )
  }

  if (!data.stage) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Stage not found</h1>
        <p className="text-body-secondary mb-0">No stage exists for this slug in this competition.</p>
      </section>
    )
  }

  if (!data.division) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Division not found</h1>
        <p className="text-body-secondary mb-0">No division exists for this slug in this stage.</p>
      </section>
    )
  }

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1 className="h2 mb-1">{data.stage.name} - {data.division.name} Standings</h1>
          <p className="text-body-secondary mb-0">Sorted by GW, then coefficient.</p>
        </div>

        <div className="d-flex gap-2">
          <Link
            className="btn btn-banana"
            to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/$divUrlSlug"
            params={{
              orgUrlSlug: data.organization.urlSlug,
              competitionUrlSlug: data.competition.urlSlug ?? '',
              stageUrlSlug: data.stage.urlSlug ?? '',
              divUrlSlug: data.division.urlSlug ?? '',
            }}
          >
            Back to Schedule
          </Link>
          <Link
            className="btn btn-outline-secondary"
            to="/org/$orgUrlSlug/competition/$competitionUrlSlug"
            params={{
              orgUrlSlug: data.organization.urlSlug,
              competitionUrlSlug: data.competition.urlSlug ?? '',
            }}
            hash={data.stage.urlSlug ?? ''}
          >
            Back to Competition
          </Link>
        </div>
      </header>

      <StandingsTable rows={data.standingsRows} divNum={isNaN(divNum) ? 0 : divNum} />
      <StandingsConventions />
    </section>
  )
}
