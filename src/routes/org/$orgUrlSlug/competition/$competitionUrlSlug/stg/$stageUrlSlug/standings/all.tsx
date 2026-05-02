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
  type Organization,
  type Stage,
} from '@/schema'
import { StandingsTable, type StandingRow } from '@/components/StandingsTable'
import { StandingsConventions } from '@/components/StandingsConventions'


type DivisionStandings = {
  id: number
  name: string
  level: string
  urlSlug: string | null
  rows: StandingRow[]
}

type LoaderData = {
  organization: Organization | null
  competition: Competition | null
  stage: Stage | null
  divisionStandings: DivisionStandings[]
}

const loadAllStandings = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: {
      orgUrlSlug: string
      competitionUrlSlug: string
      stageUrlSlug: string
    }) => input,
  )
  .handler(async ({ data }): Promise<LoaderData> => {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })

    if (!organization) {
      return { organization: null, competition: null, stage: null, divisionStandings: [] }
    }

    const competition = await db.query.competitions.findFirst({
      where: and(
        eq(competitions.organizationId, organization.id),
        eq(competitions.urlSlug, data.competitionUrlSlug),
      ),
    })

    if (!competition) {
      return { organization, competition: null, stage: null, divisionStandings: [] }
    }

    const stage = await db.query.stages.findFirst({
      where: and(
        eq(stages.competitionId, competition.id),
        eq(stages.urlSlug, data.stageUrlSlug),
      ),
    })

    if (!stage) {
      return { organization, competition, stage: null, divisionStandings: [] }
    }

    const stageDivisions = await db.query.divisions.findMany({
      where: eq(divisions.stageId, stage.id),
    })

    // Sort divisions by level number (Div 1, Div 2, …)
    stageDivisions.sort((a, b) => {
      const numA = parseInt(a.level.replace(/[^0-9]/g, ''), 10)
      const numB = parseInt(b.level.replace(/[^0-9]/g, ''), 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.level.localeCompare(b.level)
    })

    const divisionStandings: DivisionStandings[] = []

    for (const division of stageDivisions) {
      const standingsWithTeams = await db.query.standings.findMany({
        where: and(
          eq(standings.stageId, stage.id),
          eq(standings.divisionId, division.id),
        ),
        with: { team: true },
      })

      const rows: StandingRow[] = standingsWithTeams
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

      divisionStandings.push({
        id: division.id,
        name: division.name,
        level: division.level,
        urlSlug: division.urlSlug,
        rows,
      })
    }

    return { organization, competition, stage, divisionStandings }
  })

export const Route = createFileRoute(
  '/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/standings/all',
)({
  loader: async ({ params }) =>
    loadAllStandings({
      data: {
        orgUrlSlug: params.orgUrlSlug,
        competitionUrlSlug: params.competitionUrlSlug,
        stageUrlSlug: params.stageUrlSlug,
      },
    }),
  component: AllStandingsPage,
})

function AllStandingsPage() {
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

  if (!data.stage) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Stage not found</h1>
        <p className="text-body-secondary mb-0">No stage exists for this slug in this competition.</p>
      </section>
    )
  }

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1 className="h2 mb-1">{data.stage.name} — Standings</h1>
          <p className="text-body-secondary mb-0">Sorted by GW, then coefficient.</p>
        </div>

        <div className="d-flex gap-2">
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

      {data.divisionStandings.length === 0 ? (
        <p className="text-body-secondary mb-0">No divisions found for this stage.</p>
      ) : (
        <>
          {data.divisionStandings.map((division) => {
            const divNum = parseInt(division.level.replace(/[^0-9]/g, ''), 10)
            return (
              <div key={division.id} className="mb-5">
                <h2 className="h4 mb-3">{division.name}</h2>
                <StandingsTable rows={division.rows} divNum={isNaN(divNum) ? 0 : divNum} />
              </div>
            )
          })}

          <StandingsConventions />
        </>
      )}
    </section>
  )
}
