import { and, eq, ne } from 'drizzle-orm'
import { useEffect } from 'react'
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '@/db/client'
import { competitions, organizations, stages } from '@/schema'
import { splitDivisionName, slugifyGroupTitle } from '@/domain/divisionGrouping'

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
        playStages: [],
      }
    }

    const playStagesRaw = await db.query.stages.findMany({
      where: and(
        eq(stages.competitionId, competition.id),
        ne(stages.type, 'REGISTRATION'),
      ),
      with: {
        divisions: {
          orderBy: (division, { asc }) => [asc(division.level)],
          with: {
            games: {
              columns: {
                startTime: true,
              },
            },
          },
        },
      },
    })

    const playStages = playStagesRaw
      .map((stage) => {
        const stageStartTimes = stage.divisions.flatMap((division) =>
          division.games
            .map((game) => game.startTime)
            .filter((startTime): startTime is Date => startTime !== null),
        )

        const stageDate =
          stageStartTimes.length > 0
            ? new Date(
                Math.max(...stageStartTimes.map((startTime) => startTime.getTime())),
              )
            : null

        return {
          ...stage,
          divisions: stage.divisions.map(({ games, ...division }) => division),
          stageDate,
        }
      })
      .sort((a, b) => {
        const aTime = a.stageDate?.getTime() ?? Number.NEGATIVE_INFINITY
        const bTime = b.stageDate?.getTime() ?? Number.NEGATIVE_INFINITY
        if (bTime !== aTime) {
          return bTime - aTime
        }

        return b.id - a.id
      })

    return {
      organization,
      competition,
      playStages,
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
  const { pathname, hash } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      hash: state.location.hash,
    }),
  })

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const stageDetails = Array.from(
        document.querySelectorAll('details[name="competition-stages"]'),
      ) as HTMLDetailsElement[]

      const selectedStageSlug = hash.replace(/^#/, '')

      if (!selectedStageSlug) {
        stageDetails.forEach((details, index) => {
          details.open = index === 0
        })
        return
      }

      stageDetails.forEach((details) => {
        details.open = false
      })

      const wrapper = document.getElementById(selectedStageSlug)
      const target = wrapper?.querySelector(
        'details[name="competition-stages"]',
      ) as HTMLDetailsElement | null

      if (!target) {
        stageDetails.forEach((details, index) => {
          details.open = index === 0
        })
        return
      }

      target.open = true
      if (wrapper) {
        wrapper.scrollIntoView({ block: 'start' })
      }
    })

    return () => cancelAnimationFrame(frameId)
  }, [hash, data?.playStages.length])

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

      {data.playStages.map((stage, index) => {
        const stageSectionId = stage.urlSlug ?? `stage-${stage.id}`
        const groupedDivisions = stage.divisions.reduce<
          Array<{
            groupTitle: string
            items: Array<{
              division: (typeof stage.divisions)[number]
              poolLabel: string | null
            }>
          }>
        >((groups, division) => {
          const { groupTitle, poolLabel } = splitDivisionName(division.name)
          const existing = groups.find((group) => group.groupTitle === groupTitle)

          if (existing) {
            existing.items.push({ division, poolLabel })
            return groups
          }

          groups.push({
            groupTitle,
            items: [{ division, poolLabel }],
          })

          return groups
        }, [])

        const stageContent = (
          <div className="d-flex flex-column gap-3 mt-3">
            {groupedDivisions.map((group) => (
              <div key={group.groupTitle} className="text-start">
                <h2 className="h4 mb-2 text-center d-flex justify-content-center align-items-center gap-2 flex-wrap">
                  {group.groupTitle}
                  {group.items.length > 1 ? (
                    <Link
                      className="btn btn-sm btn-outline-secondary"
                      to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/standings/all"
                      params={{
                        orgUrlSlug: data.organization.urlSlug,
                        competitionUrlSlug: data.competition.urlSlug ?? '',
                        stageUrlSlug: stage.urlSlug ?? '',
                      }}
                      hash={`group-${slugifyGroupTitle(group.groupTitle)}`}
                    >
                      Combined Standings
                    </Link>
                  ) : null}
                </h2>
                <div className="d-flex flex-column gap-2">
                  {group.items.map(({ division, poolLabel }) => (
                    <div key={division.id} className="border rounded p-2">
                      {poolLabel ? <h3 className="h6 d-lg-none mb-2">{poolLabel}</h3> : null}
                      <div className="d-flex w-100 gap-2 justify-content-center align-items-center">
                        <div className="d-none d-lg-block text-start fw-semibold" style={{ minWidth: 84 }}>
                          {poolLabel ?? division.name}
                        </div>
                        <div className="d-flex w-100 gap-2 justify-content-center">
                          <Link
                            className="btn btn-banana w-50"
                            to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/$divUrlSlug"
                            params={{
                              orgUrlSlug: data.organization.urlSlug,
                              competitionUrlSlug: data.competition.urlSlug ?? '',
                              stageUrlSlug: stage.urlSlug ?? '',
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
                              stageUrlSlug: stage.urlSlug ?? '',
                              divUrlSlug: division.urlSlug ?? '',
                            }}
                          >
                            Standings
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )

        return (
          <div key={stage.id} id={stageSectionId} className="mb-4">
          <details
            name="competition-stages"
            open={index === 0}
            className="border rounded p-3 text-center"
          >
            <summary
              className="h4 mb-0 position-relative text-center"
              style={{ cursor: 'pointer', listStyle: 'none' }}
            >
              <span className="position-absolute start-0 top-50 translate-middle-y" aria-hidden="true">
                &#9654;
              </span>
              <span>{stage.name}</span>
              <Link
                className="btn btn-outline-secondary btn-sm d-none d-md-inline-flex position-absolute end-0 top-50 translate-middle-y"
                to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/standings/all"
                params={{
                  orgUrlSlug: data.organization.urlSlug,
                  competitionUrlSlug: data.competition.urlSlug ?? '',
                  stageUrlSlug: stage.urlSlug ?? '',
                }}
                onClick={(event) => event.stopPropagation()}
              >
                All Standings
              </Link>
            </summary>
            <div className="d-md-none d-flex justify-content-center mt-2">
              <Link
                className="btn btn-outline-secondary btn-sm"
                to="/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/standings/all"
                params={{
                  orgUrlSlug: data.organization.urlSlug,
                  competitionUrlSlug: data.competition.urlSlug ?? '',
                  stageUrlSlug: stage.urlSlug ?? '',
                }}
              >
                All Standings
              </Link>
            </div>
            {stageContent}
          </details>
          </div>
        )
      })}

    </section>
  )
}