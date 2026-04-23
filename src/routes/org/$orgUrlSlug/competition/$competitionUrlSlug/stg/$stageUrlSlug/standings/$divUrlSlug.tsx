import { and, eq } from 'drizzle-orm'
import { Fragment } from 'react'
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

type StandingRow = {
  id: number
  teamId: number
  teamName: string
  gamesWon: number | null
  gamesLost: number | null
  pointsFor: number | null
  pointsAgainst: number | null
  coefficient: string | null
  penalties: number | null
  leaguePoints: number | null
  leaguePointsMinusPenalties: number | null
}

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

function asDisplayNumber(value: number | null): string {
  return value === null ? '--' : String(value)
}

function asDisplayCoefficient(value: string | null): string {
  return value === null ? '--' : value
}

function DivisionStandingsPage() {
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
          >
            Back to Competition
          </Link>
        </div>
      </header>

      {data.standingsRows.length === 0 ? (
        <p className="text-body-secondary mb-0">No standings records found for this division yet.</p>
      ) : (
        <>
          <div className="table-responsive d-none d-md-block">
            <table className="table table-striped table-hover align-middle">
              <thead>
                <tr>
                  <th scope="col" className="text-center">#</th>
                  <th scope="col">Team</th>
                  <th scope="col" className="text-center">GW</th>
                  <th scope="col" className="text-center">GL</th>
                  <th scope="col" className="text-center">PF</th>
                  <th scope="col" className="text-center">PA</th>
                  <th scope="col" className="text-center">Coef.</th>
                  <th scope="col" className="text-center">P</th>
                  <th scope="col" className="text-center">LP</th>
                  <th scope="col" className="text-center">LP-P</th>
                </tr>
              </thead>
              <tbody>
                {data.standingsRows.map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row" className="text-center">{index + 1}</th>
                    <td style={{ minWidth: '8rem', maxWidth: '16rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.teamName}</td>
                    <td className="text-center">{asDisplayNumber(row.gamesWon)}</td>
                    <td className="text-center">{asDisplayNumber(row.gamesLost)}</td>
                    <td className="text-center">{asDisplayNumber(row.pointsFor)}</td>
                    <td className="text-center">{asDisplayNumber(row.pointsAgainst)}</td>
                    <td className="text-center">{asDisplayCoefficient(row.coefficient)}</td>
                    <td className="text-center">{asDisplayNumber(row.penalties)}</td>
                    <td className="text-center">{asDisplayNumber(row.leaguePoints)}</td>
                    <td className="text-center">{asDisplayNumber(row.leaguePointsMinusPenalties)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-responsive d-md-none">
            <table className="table table-sm table-bordered align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col" className="text-center">Team</th>
                  <th scope="col" className="text-center">GW</th>
                  <th scope="col" className="text-center">GL</th>
                  <th scope="col" className="text-center">PF</th>
                  <th scope="col" className="text-center">PA</th>
                </tr>
              </thead>
              <tbody>
                {data.standingsRows.map((row, index) => (
                  <Fragment key={row.id}>
                    <tr>
                      <th scope="row" rowSpan={4} className="align-middle text-nowrap">
                        <div className="fw-semibold" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}><b>#{index + 1}</b> - {row.teamName}</div>
                      </th>
                      <td className="text-center">{asDisplayNumber(row.gamesWon)}</td>
                      <td className="text-center">{asDisplayNumber(row.gamesLost)}</td>
                      <td className="text-center">{asDisplayNumber(row.pointsFor)}</td>
                      <td className="text-center">{asDisplayNumber(row.pointsAgainst)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="text-center"><b>Coef.</b></td>
                      <td colSpan={2} className="text-center">{asDisplayCoefficient(row.coefficient)}</td>
                    </tr>
                    <tr>
                      <td className="text-center">
                        <b>P</b>
                      </td>
                      <td className="text-center">
                        {asDisplayNumber(row.penalties)}
                      </td>
                      <td className="text-center">
                        <b>LP</b>
                      </td>
                      <td className="text-center">
                        {asDisplayNumber(row.leaguePoints)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="text-center">
                        <b>LP-P</b>
                      </td>
                      <td colSpan={2} className="text-center">
                        {asDisplayNumber(row.leaguePointsMinusPenalties)}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 border rounded bg-body-secondary small">
            <p className="fw-semibold mb-1">Conventions</p>
            <ul className="mb-0 ps-3">
              <li><b>GW</b> — Games Won</li>
              <li><b>GL</b> — Games Lost</li>
              <li><b>PF</b> — Points For</li>
              <li><b>PA</b> — Points Against</li>
              <li><b>Coef.</b> — Coefficient (PF / PA)</li>
              <li><b>P</b> — Penalties</li>
              <li><b>LP</b> — League Points</li>
              <li><b>LP-P</b> — League Points minus Penalties</li>
            </ul>
          </div>
        </>
      )}
    </section>
  )
}
