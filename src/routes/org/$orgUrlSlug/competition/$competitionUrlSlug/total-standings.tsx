import { and, eq } from 'drizzle-orm'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { StandingsConventions } from '@/components/StandingsConventions'
import { StandingsTable, type StandingRow } from '@/components/StandingsTable'
import { db } from '@/db/client'
import {
  competitions,
  organizations,
  stages,
  standings,
  type Competition,
  type Organization,
  type Stage,
} from '@/schema'

type LoaderData = {
  organization: Organization | null
  competition: Competition | null
  registrationStage: Stage | null
  rows: StandingRow[]
}

const loadTotalStandings = createServerFn({ method: 'GET' })
  .inputValidator((input: { orgUrlSlug: string; competitionUrlSlug: string }) => input)
  .handler(async ({ data }): Promise<LoaderData> => {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })

    if (!organization) {
      return { organization: null, competition: null, registrationStage: null, rows: [] }
    }

    const competition = await db.query.competitions.findFirst({
      where: and(
        eq(competitions.organizationId, organization.id),
        eq(competitions.urlSlug, data.competitionUrlSlug),
      ),
    })

    if (!competition) {
      return { organization, competition: null, registrationStage: null, rows: [] }
    }

    if (!competition.registrationStageId) {
      return { organization, competition, registrationStage: null, rows: [] }
    }

    const registrationStage = await db.query.stages.findFirst({
      where: and(
        eq(stages.id, competition.registrationStageId),
        eq(stages.competitionId, competition.id),
      ),
    })

    const standingsRowsRaw = await db.query.standings.findMany({
      where: eq(standings.stageId, competition.registrationStageId),
      with: {
        team: true,
      },
    })

    const rows = standingsRowsRaw
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
        const lppA = a.leaguePointsMinusPenalties ?? Number.NEGATIVE_INFINITY
        const lppB = b.leaguePointsMinusPenalties ?? Number.NEGATIVE_INFINITY
        if (lppB !== lppA) return lppB - lppA

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
      registrationStage,
      rows,
    }
  })

export const Route = createFileRoute('/org/$orgUrlSlug/competition/$competitionUrlSlug/total-standings')({
  loader: async ({ params }) =>
    loadTotalStandings({
      data: {
        orgUrlSlug: params.orgUrlSlug,
        competitionUrlSlug: params.competitionUrlSlug,
      },
    }),
  component: TotalStandingsPage,
})

function TotalStandingsPage() {
  const data = Route.useLoaderData()

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

  if (!data.registrationStage) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Registration stage not found</h1>
        <p className="text-body-secondary mb-0">No registration stage exists for this competition.</p>
      </section>
    )
  }

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1 className="h2 mb-1">Total Standings</h1>
          <p className="text-body-secondary mb-0">Sorted by LP-P, then GW, then coefficient.</p>
        </div>

        <div className="d-flex gap-2">
          <Link
            className="btn btn-outline-secondary"
            to="/org/$orgUrlSlug/competition/$competitionUrlSlug"
            params={{
              orgUrlSlug: data.organization.urlSlug,
              competitionUrlSlug: data.competition.urlSlug ?? '',
            }}
          >
            Back to Competition
          </Link>
        </div>
      </header>

      <StandingsTable rows={data.rows} divNum={99} highlightMovementRows={false} groupEveryNRows={4} />
      <StandingsConventions showMovementColors={false} />
    </section>
  )
}
