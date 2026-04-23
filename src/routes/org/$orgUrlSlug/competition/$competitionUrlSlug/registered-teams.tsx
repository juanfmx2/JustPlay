import { and, eq } from 'drizzle-orm'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '@/db/client'
import { competitions, divisions, organizations, stages } from '@/schema'

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

    return {
      organization,
      competition,
      divisions: registrationDivisions,
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
        <div className="row g-3 g-lg-4 row-cols-1 row-cols-md-2">
          {data.divisions.map((division) => (
            <div className="col" key={division.id}>
              <article className="card h-100 shadow-sm">
                <div className="card-body d-flex flex-column">
                  <header className="mb-3">
                    <h2 className="h5 mb-1">{division.name}</h2>
                  </header>

                  {division.teams.length === 0 ? (
                    <p className="text-body-secondary mb-0">No teams in this division yet.</p>
                  ) : (
                    <ul className="list-group list-group-flush mt-auto">
                      {division.teams.map((team) => (
                        <li
                          key={team.id}
                          className="list-group-item d-flex justify-content-between align-items-center px-0"
                        >
                          <span>{team.name}</span>
                          <span className="small text-body-secondary">{team.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
