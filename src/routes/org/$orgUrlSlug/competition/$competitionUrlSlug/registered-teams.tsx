import { and, eq, ne } from 'drizzle-orm'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '@/db/client'
import { competitions, divisions, organizations, stages } from '@/schema'

function splitDivisionName(name: string): { groupTitle: string; poolLabel: string } {
  const match = name.match(/^(.*?)\s*-\s*(Pool\s+[A-Za-z0-9]+)$/i)

  if (!match) {
    return {
      groupTitle: name,
      poolLabel: name,
    }
  }

  return {
    groupTitle: match[1].trim(),
    poolLabel: match[2].trim(),
  }
}

const loadRegisteredTeams = createServerFn({ method: 'GET' })
  .inputValidator((input: { orgUrlSlug: string; competitionUrlSlug: string }) => input)
  .handler(async ({ data }) => {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })

    if (!organization) return null

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
        divisions: [],
      }
    }

    const registrationStage = competition.registrationStageId
      ? await db.query.stages.findFirst({
          where: and(
            eq(stages.id, competition.registrationStageId),
            eq(stages.competitionId, competition.id),
          ),
        })
      : await db.query.stages.findFirst({
          where: and(
            eq(stages.competitionId, competition.id),
            eq(stages.type, 'REGISTRATION'),
          ),
        })

    const registrationDivisions = registrationStage
      ? await db.query.divisions.findMany({
          where: eq(divisions.stageId, registrationStage.id),
          orderBy: (division, { asc }) => [asc(division.id)],
          with: {
            teams: {
              orderBy: (team, { asc }) => [asc(team.id)],
            },
          },
        })
      : []

    const nonRegistrationStages = await db.query.stages.findMany({
      where: and(
        eq(stages.competitionId, competition.id),
        ne(stages.type, 'REGISTRATION'),
      ),
      orderBy: (stage, { asc }) => [asc(stage.id)],
      with: {
        divisions: {
          with: {
            teams: {
              columns: {
                id: true,
              },
            },
            games: {
              columns: {
                teamAId: true,
                teamBId: true,
              },
            },
          },
        },
      },
    })

    const stageLinksByTeamId = new Map<
      number,
      Array<{ stageName: string; stageUrlSlug: string; divisionUrlSlug: string }>
    >()

    for (const stage of nonRegistrationStages) {
      if (!stage.urlSlug) continue

      for (const stageDivision of stage.divisions) {
        if (!stageDivision.urlSlug) continue

        const teamIdsInDivision = new Set<number>()

        for (const team of stageDivision.teams) {
          teamIdsInDivision.add(team.id)
        }

        for (const game of stageDivision.games) {
          teamIdsInDivision.add(game.teamAId)
          teamIdsInDivision.add(game.teamBId)
        }

        for (const teamId of teamIdsInDivision) {
          const links = stageLinksByTeamId.get(teamId) ?? []
          if (
            !links.some(
              (entry) =>
                entry.stageUrlSlug === stage.urlSlug &&
                entry.divisionUrlSlug === stageDivision.urlSlug,
            )
          ) {
            links.push({
              stageName: stage.name,
              stageUrlSlug: stage.urlSlug,
              divisionUrlSlug: stageDivision.urlSlug,
            })
          }
          stageLinksByTeamId.set(teamId, links)
        }
      }
    }

    return {
      organization,
      competition,
      divisions: registrationDivisions,
      stageLinksByTeamId: Object.fromEntries(stageLinksByTeamId),
    }
  })

export const Route = createFileRoute(
  '/org/$orgUrlSlug/competition/$competitionUrlSlug/registered-teams',
)({
  loader: async ({ params }) =>
    loadRegisteredTeams({
      data: {
        orgUrlSlug: params.orgUrlSlug,
        competitionUrlSlug: params.competitionUrlSlug,
      },
    }),
  component: RegisteredTeamsPage,
})

function RegisteredTeamsPage() {
  const data = Route.useLoaderData()

  if (!data) {
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
        <p className="text-body-secondary mb-0">
          No competition exists for this slug under {data.organization.name}.
        </p>
      </section>
    )
  }

  const groupedDivisions = data.divisions.reduce<
    Array<{
      groupTitle: string
      divisions: Array<(typeof data.divisions)[number] & { poolLabel: string }>
    }>
  >((groups, division) => {
    const { groupTitle, poolLabel } = splitDivisionName(division.name)
    const existingGroup = groups.find((group) => group.groupTitle === groupTitle)

    if (existingGroup) {
      existingGroup.divisions.push({ ...division, poolLabel })
      return groups
    }

    groups.push({
      groupTitle,
      divisions: [{ ...division, poolLabel }],
    })

    return groups
  }, [])

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1 className="h2 mb-1">Registered Teams</h1>
          <p className="text-body-secondary mb-0">{data.competition.name}</p>
        </div>
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
      </header>

      {data.divisions.length === 0 ? (
        <p className="text-body-secondary mb-0">No divisions found in registration.</p>
      ) : (
        <div className="d-flex flex-column gap-4">
          {groupedDivisions.map((group) => (
            <section key={group.groupTitle}>
              <h2 className="h4 mb-3">{group.groupTitle}</h2>
              <div className="row g-3 g-lg-4 row-cols-1 row-cols-md-2">
                {group.divisions.map((division) => (
                  <div className="col" key={division.id}>
                    <article className="card h-100 shadow-sm">
                      <div className="card-body d-flex flex-column">
                        <header className="mb-3">
                          <h3 className="h5 mb-1">{division.poolLabel}</h3>
                        </header>

                        {division.teams.length === 0 ? (
                          <p className="text-body-secondary mb-0">No teams in this pool yet.</p>
                        ) : (
                          <ul className="list-group list-group-flush mt-auto">
                            {division.teams.map((team) => (
                              <li
                                key={team.id}
                                className="list-group-item d-flex justify-content-between align-items-center gap-2 px-0"
                              >
                                <span>{team.name}</span>
                                <div className="d-flex flex-column align-items-end">
                                  {(data.stageLinksByTeamId[team.id] ?? []).length === 0 ? (
                                    <span className="small text-body-secondary">No stage schedules yet</span>
                                  ) : (
                                    <div className="d-flex flex-column align-items-end gap-1">
                                      {(data.stageLinksByTeamId[team.id] ?? []).map((entry) => (
                                        <Link
                                          key={`${team.id}-${entry.stageUrlSlug}-${entry.divisionUrlSlug}`}
                                          className="small"
                                          to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/$divUrlSlug"
                                          params={{
                                            orgUrlSlug: data.organization.urlSlug,
                                            competitionUrlSlug: data.competition.urlSlug ?? '',
                                            stageUrlSlug: entry.stageUrlSlug,
                                            divUrlSlug: entry.divisionUrlSlug,
                                          }}
                                        >
                                          {entry.stageUrlSlug} schedule
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
