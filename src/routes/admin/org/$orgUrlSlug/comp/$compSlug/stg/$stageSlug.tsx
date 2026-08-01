import { and, eq } from 'drizzle-orm'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { CheckCircleFill, XCircleFill } from 'react-bootstrap-icons'

import { db } from '@/db/client'
import { competitions, divisions, organizations, stages } from '@/schema'
import { splitDivisionName } from '@/domain/divisionGrouping'
import { requireAdminPrincipal } from '@/server/auth'
import { CompletionBadge } from '@/components/CompletionBadge'

type PoolRow = {
  divisionId: number
  divisionName: string
  urlSlug: string | null
  total: number
  completed: number
  adminChecked: number
}

type TeamRow = {
  teamId: number
  teamName: string
  total: number
  completed: number
  adminChecked: number
}

type TeamGroup = {
  groupTitle: string
  teams: TeamRow[]
}

type RegTeamRow = {
  teamId: number
  teamName: string
  hasLoggedIn: boolean
}

type RegDivisionGroup = {
  divisionId: number
  divisionName: string
  teams: RegTeamRow[]
}

type LoaderData =
  | null
  | {
      kind: 'play'
      orgName: string
      competitionName: string
      stageName: string
      orgUrlSlug: string
      competitionUrlSlug: string
      stageUrlSlug: string
      pools: PoolRow[]
      poolsOverallPercent: number
      poolsAdminOverallPercent: number
      teamGroups: TeamGroup[]
      teamsOverallPercent: number
      teamsAdminOverallPercent: number
    }
  | {
      kind: 'registration'
      orgName: string
      competitionName: string
      stageName: string
      divisionGroups: RegDivisionGroup[]
      loginOverallPercent: number
    }

function divisionSortKey(level: string): number {
  const match = level.match(/\d+/)
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER
}

function percentOf(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100)
}

const loadStageSummary = createServerFn({ method: 'GET' })
  .inputValidator((input: { orgUrlSlug: string; compSlug: string; stageSlug: string }) => input)
  .handler(async ({ data }): Promise<LoaderData> => {
    await requireAdminPrincipal()

    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })
    if (!organization) return null

    const competition = await db.query.competitions.findFirst({
      where: and(eq(competitions.organizationId, organization.id), eq(competitions.urlSlug, data.compSlug)),
    })
    if (!competition) return null

    const stage = await db.query.stages.findFirst({
      where: and(eq(stages.competitionId, competition.id), eq(stages.urlSlug, data.stageSlug)),
    })
    if (!stage) return null

    if (stage.type === 'REGISTRATION') {
      const stageDivisions = await db.query.divisions.findMany({
        where: eq(divisions.stageId, stage.id),
        with: {
          teams: { columns: { id: true, name: true, lastLoginAt: true } },
        },
      })

      stageDivisions.sort((a, b) => divisionSortKey(a.level) - divisionSortKey(b.level))

      const divisionGroups: RegDivisionGroup[] = stageDivisions.map((division) => ({
        divisionId: division.id,
        divisionName: division.name,
        teams: division.teams
          .map((team) => ({ teamId: team.id, teamName: team.name, hasLoggedIn: team.lastLoginAt !== null }))
          .sort((a, b) => a.teamName.localeCompare(b.teamName)),
      }))

      const allTeams = divisionGroups.flatMap((group) => group.teams)
      const loginOverallPercent = percentOf(allTeams.filter((team) => team.hasLoggedIn).length, allTeams.length)

      return {
        kind: 'registration',
        orgName: organization.name,
        competitionName: competition.name,
        stageName: stage.name,
        divisionGroups,
        loginOverallPercent,
      }
    }

    const stageDivisions = await db.query.divisions.findMany({
      where: eq(divisions.stageId, stage.id),
      with: {
        games: {
          columns: { id: true, teamAId: true, teamBId: true, finishedAt: true, adminValidatedAt: true },
          with: {
            teamA: { with: { division: { columns: { name: true } } } },
            teamB: { with: { division: { columns: { name: true } } } },
          },
        },
      },
    })

    stageDivisions.sort((a, b) => divisionSortKey(a.level) - divisionSortKey(b.level))

    const pools: PoolRow[] = stageDivisions.map((division) => {
      const total = division.games.length
      const completed = division.games.filter((game) => game.finishedAt !== null).length
      const adminChecked = division.games.filter((game) => game.adminValidatedAt !== null).length

      return {
        divisionId: division.id,
        divisionName: division.name,
        urlSlug: division.urlSlug,
        total,
        completed,
        adminChecked,
      }
    })

    const teamStatsById = new Map<
      number,
      { teamName: string; registrationDivisionName: string | null; total: number; completed: number; adminChecked: number }
    >()

    for (const division of stageDivisions) {
      for (const game of division.games) {
        for (const team of [game.teamA, game.teamB]) {
          if (!team) continue

          const existing = teamStatsById.get(team.id) ?? {
            teamName: team.name,
            registrationDivisionName: team.division?.name ?? null,
            total: 0,
            completed: 0,
            adminChecked: 0,
          }

          existing.total += 1
          if (game.finishedAt !== null) existing.completed += 1
          if (game.adminValidatedAt !== null) existing.adminChecked += 1

          teamStatsById.set(team.id, existing)
        }
      }
    }

    const teamGroupsByTitle = new Map<string, TeamGroup>()
    for (const [teamId, stats] of teamStatsById) {
      const { groupTitle } = splitDivisionName(stats.registrationDivisionName ?? 'Unassigned')
      const group = teamGroupsByTitle.get(groupTitle) ?? { groupTitle, teams: [] }
      group.teams.push({
        teamId,
        teamName: stats.teamName,
        total: stats.total,
        completed: stats.completed,
        adminChecked: stats.adminChecked,
      })
      teamGroupsByTitle.set(groupTitle, group)
    }

    const teamGroups = Array.from(teamGroupsByTitle.values()).sort((a, b) => {
      const keyA = divisionSortKey(a.groupTitle)
      const keyB = divisionSortKey(b.groupTitle)
      if (keyA !== keyB) return keyA - keyB
      return a.groupTitle.localeCompare(b.groupTitle)
    })
    for (const group of teamGroups) {
      group.teams.sort((a, b) => a.teamName.localeCompare(b.teamName))
    }

    const poolsTotalGames = pools.reduce((sum, pool) => sum + pool.total, 0)
    const poolsCompletedGames = pools.reduce((sum, pool) => sum + pool.completed, 0)
    const poolsAdminCheckedGames = pools.reduce((sum, pool) => sum + pool.adminChecked, 0)

    const allTeamStats = Array.from(teamStatsById.values())
    const teamsTotalGames = allTeamStats.reduce((sum, team) => sum + team.total, 0)
    const teamsCompletedGames = allTeamStats.reduce((sum, team) => sum + team.completed, 0)
    const teamsAdminCheckedGames = allTeamStats.reduce((sum, team) => sum + team.adminChecked, 0)

    return {
      kind: 'play',
      orgName: organization.name,
      competitionName: competition.name,
      stageName: stage.name,
      orgUrlSlug: organization.urlSlug,
      competitionUrlSlug: competition.urlSlug ?? '',
      stageUrlSlug: stage.urlSlug ?? '',
      pools,
      poolsOverallPercent: percentOf(poolsCompletedGames, poolsTotalGames),
      poolsAdminOverallPercent: percentOf(poolsAdminCheckedGames, poolsTotalGames),
      teamGroups,
      teamsOverallPercent: percentOf(teamsCompletedGames, teamsTotalGames),
      teamsAdminOverallPercent: percentOf(teamsAdminCheckedGames, teamsTotalGames),
    }
  })

export const Route = createFileRoute('/admin/org/$orgUrlSlug/comp/$compSlug/stg/$stageSlug')({
  loader: async ({ params }) =>
    loadStageSummary({
      data: { orgUrlSlug: params.orgUrlSlug, compSlug: params.compSlug, stageSlug: params.stageSlug },
    }),
  component: StageSummaryPage,
})

function StageSummaryPage() {
  const data = Route.useLoaderData()

  if (!data) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Stage not found</h1>
        <p className="text-body-secondary mb-0">No stage exists for this slug.</p>
      </section>
    )
  }

  if (data.kind === 'registration') {
    return (
      <section className="container py-4">
        <header className="mb-4">
          <h1 className="h2 mb-1">{data.stageName} - Team Logins</h1>
          <p className="text-body-secondary mb-0">
            {data.orgName} / {data.competitionName}
          </p>
        </header>

        <details open className="border rounded p-3 mb-3">
          <summary className="h5 mb-0 d-flex flex-wrap align-items-center gap-2" style={{ cursor: 'pointer' }}>
            <span>Team Logins</span>
            <CompletionBadge percent={data.loginOverallPercent} />
          </summary>

          <div className="mt-3 d-flex flex-column gap-4">
            {data.divisionGroups.map((group) => (
              <div key={group.divisionId}>
                <h3 className="h6 mb-2">{group.divisionName}</h3>
                <div className="table-responsive">
                  <table className="table table-striped table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Team</th>
                        <th scope="col" className="text-center">Logged In</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.teams.map((team) => (
                        <tr key={team.teamId}>
                          <td>{team.teamName}</td>
                          <td className="text-center">
                            {team.hasLoggedIn ? (
                              <span className="badge text-bg-success d-inline-flex align-items-center gap-1">
                                <CheckCircleFill /> Yes
                              </span>
                            ) : (
                              <span className="badge text-bg-danger d-inline-flex align-items-center gap-1">
                                <XCircleFill /> No
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>
    )
  }

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">{data.stageName} - Stage Summary</h1>
        <p className="text-body-secondary mb-0">
          {data.orgName} / {data.competitionName}
        </p>
      </header>

      <details open className="border rounded p-3 mb-3">
        <summary className="h5 mb-0 d-flex flex-wrap align-items-center gap-2" style={{ cursor: 'pointer' }}>
          <span>Stage Completion</span>
          <CompletionBadge percent={data.poolsOverallPercent} />
        </summary>

        <div className="table-responsive mt-3">
          <table className="table table-striped table-hover align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Pool</th>
                <th scope="col"></th>
                <th scope="col" className="text-center">Completed</th>
                <th scope="col" className="text-center">Admin Checked</th>
              </tr>
            </thead>
            <tbody>
              {data.pools.map((pool) => (
                <tr key={pool.divisionId}>
                  <td>{pool.divisionName}</td>
                  <td>
                    <Link
                      className="btn btn-sm btn-outline-secondary"
                      to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/$divUrlSlug"
                      params={{
                        orgUrlSlug: data.orgUrlSlug,
                        competitionUrlSlug: data.competitionUrlSlug,
                        stageUrlSlug: data.stageUrlSlug,
                        divUrlSlug: pool.urlSlug ?? '',
                      }}
                    >
                      Schedule
                    </Link>
                  </td>
                  <td className="text-center"><CompletionBadge percent={percentOf(pool.completed, pool.total)} /></td>
                  <td className="text-center"><CompletionBadge percent={percentOf(pool.adminChecked, pool.total)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details open className="border rounded p-3 mb-3">
        <summary className="h5 mb-0 d-flex flex-wrap align-items-center gap-2" style={{ cursor: 'pointer' }}>
          <span>Teams Completion</span>
          <CompletionBadge percent={data.teamsOverallPercent} />
        </summary>

        <div className="mt-3 d-flex flex-column gap-4">
          {data.teamGroups.map((group) => (
            <div key={group.groupTitle}>
              <h3 className="h6 mb-2">{group.groupTitle}</h3>
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Team</th>
                      <th scope="col" className="text-center">Completed</th>
                      <th scope="col" className="text-center">Admin Checked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.teams.map((team) => (
                      <tr key={team.teamId}>
                        <td>{team.teamName}</td>
                        <td className="text-center"><CompletionBadge percent={percentOf(team.completed, team.total)} /></td>
                        <td className="text-center"><CompletionBadge percent={percentOf(team.adminChecked, team.total)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}
