import { and, eq } from 'drizzle-orm'
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '@/db/client'
import { competitions, divisions, organizations, stages } from '@/schema'

const loadCompetitionRegistration = createServerFn({ method: 'GET' })
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
        week1Stage: null,
        week1Divisions: [],
      }
    }

    const week1Stage = await db.query.stages.findFirst({
      where: and(eq(stages.competitionId, competition.id), eq(stages.urlSlug, 'week-1')),
    })

    const week1Divisions = week1Stage
      ? await db.query.divisions.findMany({
          where: eq(divisions.stageId, week1Stage.id),
          orderBy: (division, { asc }) => [asc(division.level)],
        })
      : []

    return {
      organization,
      competition,
      week1Stage,
      week1Divisions,
    }
  })

export const Route = createFileRoute('/org/$orgUrlSlug/competition/$competitionUrlSlug')({
  loader: async ({ params }) => {
    return loadCompetitionRegistration({
      data: {
        orgUrlSlug: params.orgUrlSlug,
        competitionUrlSlug: params.competitionUrlSlug,
      },
    })
  },
  component: CompetitionDetailPage,
})

function CompetitionDetailPage() {
  const data = Route.useLoaderData()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (
    pathname.includes('/rules') ||
    pathname.includes('/stg/') ||
    pathname.includes('/registered-teams')
  ) {
    return <Outlet />
  }

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
        <h1 className="h2 mb-1">{data.competition.name}</h1>
        <div className="d-flex gap-2">
          {data.competition.urlSlug ? (
            <Link
              className="btn btn-outline-secondary"
              to="/org/$orgUrlSlug/competition/$competitionUrlSlug/rules"
              params={{
                orgUrlSlug: data.organization.urlSlug,
                competitionUrlSlug: data.competition.urlSlug,
              }}
            >
              View Rules
            </Link>
          ) : null}
          <Link
            className="btn btn-banana"
            to="/org/$orgUrlSlug/competition/$competitionUrlSlug/registered-teams"
            params={{
              orgUrlSlug: data.organization.urlSlug,
              competitionUrlSlug: data.competition.urlSlug ?? '',
            }}
          >
            Registered Teams
          </Link>
        </div>
      </header>

      {data.week1Stage && data.week1Divisions.length > 0 ? (
        <article className="mb-4 border rounded p-3 text-center">
          <h2 className="h4 mb-3">Week 1</h2>
          <div className="d-flex flex-column gap-3">
            {data.week1Divisions.map((division) => (
              <div key={division.id}>
                <h3 className="h6 mb-2">{division.name}</h3>
                <div className="d-flex w-100 gap-2 justify-content-center">
                  <Link
                    className="btn btn-banana w-50"
                    to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/$divUrlSlug"
                    params={{
                      orgUrlSlug: data.organization.urlSlug,
                      competitionUrlSlug: data.competition.urlSlug ?? '',
                      stageUrlSlug: data.week1Stage?.urlSlug ?? '',
                      divUrlSlug: division.urlSlug ?? '',
                    }}
                  >
                    Schedule
                  </Link>
                  <Link
                    className="btn btn-outline-secondary w-50"
                    to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/standings/$divUrlSlug"
                    params={{
                      orgUrlSlug: data.organization.urlSlug,
                      competitionUrlSlug: data.competition.urlSlug ?? '',
                      stageUrlSlug: data.week1Stage?.urlSlug ?? '',
                      divUrlSlug: division.urlSlug ?? '',
                    }}
                  >
                    Standings
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

    </section>
  )
}