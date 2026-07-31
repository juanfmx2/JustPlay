import { and, eq } from 'drizzle-orm'
import React from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
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
import { setStandingAdminBonus } from '@/domain/scorer'
import { rankStandings } from '@/domain/standingsRanking'
import { requireAdminPrincipal } from '@/server/auth'
import { getSessionPrincipal } from '@/server/auth.server'
import { PoolStandingsTable, type PoolStandingRow } from '@/components/PoolStandingsTable'

type LoaderData = {
  organization: Organization | null
  competition: Competition | null
  stage: Stage | null
  division: Division | null
  standingsRows: PoolStandingRow[]
  isAdmin: boolean
}

async function loadRankedStandingsForDivision(stageId: number, divisionId: number): Promise<PoolStandingRow[]> {
  const rows = await db.query.standings.findMany({
    where: and(eq(standings.stageId, stageId), eq(standings.divisionId, divisionId)),
    with: { team: true },
  })

  return rankStandings(
    rows.map((row) => ({
      id: row.id,
      teamId: row.teamId,
      teamName: row.team?.name ?? `Team #${row.teamId}`,
      gamesWon: row.gamesWon,
      gamesLost: row.gamesLost,
      setsFor: row.setsFor,
      setsAgainst: row.setsAgainst,
      setsCoefficient: row.setsCoefficient,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      coefficient: row.coefficient,
      leaguePoints: row.leaguePoints,
      adminBonusPoints: row.adminBonusPoints,
    })),
  )
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
    const principal = await getSessionPrincipal()
    const isAdmin = principal?.type === 'admin'

    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })

    if (!organization) {
      return { organization: null, competition: null, stage: null, division: null, standingsRows: [], isAdmin }
    }

    const competition = await db.query.competitions.findFirst({
      where: and(
        eq(competitions.organizationId, organization.id),
        eq(competitions.urlSlug, data.competitionUrlSlug),
      ),
    })

    if (!competition) {
      return { organization, competition: null, stage: null, division: null, standingsRows: [], isAdmin }
    }

    const stage = await db.query.stages.findFirst({
      where: and(
        eq(stages.competitionId, competition.id),
        eq(stages.urlSlug, data.stageUrlSlug),
      ),
    })

    if (!stage) {
      return { organization, competition, stage: null, division: null, standingsRows: [], isAdmin }
    }

    const division = await db.query.divisions.findFirst({
      where: and(eq(divisions.stageId, stage.id), eq(divisions.urlSlug, data.divUrlSlug)),
    })

    if (!division) {
      return { organization, competition, stage, division: null, standingsRows: [], isAdmin }
    }

    const standingsRows = await loadRankedStandingsForDivision(stage.id, division.id)

    return { organization, competition, stage, division, standingsRows, isAdmin }
  })

const setTieBreakWinnerServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { winnerId: number | null; groupIds: number[] }) => input)
  .handler(async ({ data }) => {
    await requireAdminPrincipal()

    for (const standingId of data.groupIds) {
      await setStandingAdminBonus(standingId, standingId === data.winnerId ? 1 : 0)
    }

    return { success: true }
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
  const router = useRouter()
  const data = Route.useLoaderData()
  const [pendingRowId, setPendingRowId] = React.useState<number | null>(null)

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

  const handleSetTieBreakWinner = async (winnerId: number | null, groupIds: number[]) => {
    setPendingRowId(winnerId ?? groupIds[0] ?? null)
    try {
      await setTieBreakWinnerServerFn({ data: { winnerId, groupIds } })
      await router.invalidate()
    } finally {
      setPendingRowId(null)
    }
  }

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1 className="h2 mb-1">{data.stage.name} - {data.division.name} Standings</h1>
          <p className="text-body-secondary mb-0">
            Sorted by league points, then sets coefficient, then points coefficient, then points for.
          </p>
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

      <PoolStandingsTable
        rows={data.standingsRows}
        isAdmin={data.isAdmin}
        pendingRowId={pendingRowId}
        onSetTieBreakWinner={handleSetTieBreakWinner}
      />

      {data.standingsRows.some((row) => row.isTied) ? (
        <p className="text-body-secondary small mt-2 mb-0">
          Highlighted rows are tied on league points, sets coefficient, points coefficient, and points for - per the
          rules, a coin toss decides the order.{data.isAdmin ? ' Use "Pick as winner" to record the result.' : ''}
        </p>
      ) : null}
    </section>
  )
}
