import React from 'react'
import { and, eq } from 'drizzle-orm'
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
  type Organization,
  type Stage,
} from '@/schema'
import { setStandingAdminBonus } from '@/domain/scorer'
import { rankStandings } from '@/domain/standingsRanking'
import { splitDivisionName, slugifyGroupTitle } from '@/domain/divisionGrouping'
import { requireAdminPrincipal } from '@/server/auth'
import { getSessionPrincipal } from '@/server/auth.server'
import { PoolStandingsTable, type PoolStandingRow } from '@/components/PoolStandingsTable'

type PoolStandings = {
  id: number
  name: string
  poolLabel: string | null
  urlSlug: string | null
  rows: PoolStandingRow[]
}

type GroupStandings = {
  groupTitle: string
  groupSlug: string
  combinedRows: PoolStandingRow[]
  pools: PoolStandings[]
}

type LoaderData = {
  organization: Organization | null
  competition: Competition | null
  stage: Stage | null
  groupStandings: GroupStandings[]
  isAdmin: boolean
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
    const principal = await getSessionPrincipal()
    const isAdmin = principal?.type === 'admin'

    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })

    if (!organization) {
      return { organization: null, competition: null, stage: null, groupStandings: [], isAdmin }
    }

    const competition = await db.query.competitions.findFirst({
      where: and(
        eq(competitions.organizationId, organization.id),
        eq(competitions.urlSlug, data.competitionUrlSlug),
      ),
    })

    if (!competition) {
      return { organization, competition: null, stage: null, groupStandings: [], isAdmin }
    }

    const stage = await db.query.stages.findFirst({
      where: and(
        eq(stages.competitionId, competition.id),
        eq(stages.urlSlug, data.stageUrlSlug),
      ),
    })

    if (!stage) {
      return { organization, competition, stage: null, groupStandings: [], isAdmin }
    }

    const stageDivisions = await db.query.divisions.findMany({
      where: eq(divisions.stageId, stage.id),
    })

    stageDivisions.sort((a, b) => {
      const numA = parseInt(a.level.replace(/[^0-9]/g, ''), 10)
      const numB = parseInt(b.level.replace(/[^0-9]/g, ''), 10)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return a.level.localeCompare(b.level)
    })

    const stageStandingsWithTeams = await db.query.standings.findMany({
      where: eq(standings.stageId, stage.id),
      with: { team: true },
    })

    const rowsByDivisionId = new Map<number, typeof stageStandingsWithTeams>()
    for (const row of stageStandingsWithTeams) {
      const existing = rowsByDivisionId.get(row.divisionId) ?? []
      existing.push(row)
      rowsByDivisionId.set(row.divisionId, existing)
    }

    const toPoolStandingRow = (row: (typeof stageStandingsWithTeams)[number]) => ({
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
    })

    const groups: GroupStandings[] = []
    for (const division of stageDivisions) {
      const { groupTitle, poolLabel } = splitDivisionName(division.name)
      const divisionRows = rowsByDivisionId.get(division.id) ?? []

      const pool: PoolStandings = {
        id: division.id,
        name: division.name,
        poolLabel,
        urlSlug: division.urlSlug,
        rows: rankStandings(divisionRows.map(toPoolStandingRow)),
      }

      const existingGroup = groups.find((group) => group.groupTitle === groupTitle)
      if (existingGroup) {
        existingGroup.pools.push(pool)
      } else {
        groups.push({
          groupTitle,
          groupSlug: slugifyGroupTitle(groupTitle),
          combinedRows: [],
          pools: [pool],
        })
      }
    }

    for (const group of groups) {
      const allRowsInGroup = group.pools.flatMap((pool) =>
        (rowsByDivisionId.get(pool.id) ?? []).map(toPoolStandingRow),
      )
      group.combinedRows = rankStandings(allRowsInGroup)
    }

    return { organization, competition, stage, groupStandings: groups, isAdmin }
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
          <h1 className="h2 mb-1">{data.stage.name} — Standings</h1>
          <p className="text-body-secondary mb-0">
            Sorted by league points, then sets coefficient, then points coefficient, then points for.
          </p>
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

      {data.groupStandings.length === 0 ? (
        <p className="text-body-secondary mb-0">No divisions found for this stage.</p>
      ) : (
        data.groupStandings.map((group) => (
          <div key={group.groupTitle} id={`group-${group.groupSlug}`} className="mb-5">
            <h2 className="h4 mb-3">{group.groupTitle}</h2>
            <PoolStandingsTable
              rows={group.combinedRows}
              isAdmin={data.isAdmin}
              pendingRowId={pendingRowId}
              onSetTieBreakWinner={handleSetTieBreakWinner}
            />

            {group.pools.length > 1 ? (
              <details className="mt-3">
                <summary className="text-body-secondary" style={{ cursor: 'pointer' }}>
                  Show individual pools
                </summary>
                <div className="d-flex flex-column gap-4 mt-3">
                  {group.pools.map((pool) => (
                    <div key={pool.id}>
                      <h3 className="h6 mb-2">{pool.poolLabel ?? pool.name}</h3>
                      <PoolStandingsTable
                        rows={pool.rows}
                        isAdmin={data.isAdmin}
                        pendingRowId={pendingRowId}
                        onSetTieBreakWinner={handleSetTieBreakWinner}
                      />
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ))
      )}
    </section>
  )
}
