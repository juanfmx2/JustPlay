import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '@/db/client'
import { competitions, divisions, stages } from '@/schema'

const TEAM_COLOR_CLASSES = ['team-a', 'team-b', 'team-c', 'team-d'] as const

const loadDivisionSchedule = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: {
      competitionUrlSlug: string
      stageUrlSlug: string
      divUrlSlug: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const competition = await db.query.competitions.findFirst({
      where: eq(competitions.urlSlug, data.competitionUrlSlug),
    })

    if (!competition) {
      return { competition: null, stage: null, division: null }
    }

    const stage = await db.query.stages.findFirst({
      where: and(
        eq(stages.competitionId, competition.id),
        eq(stages.urlSlug, data.stageUrlSlug),
      ),
    })

    if (!stage) {
      return { competition, stage: null, division: null }
    }

    const division = await db.query.divisions.findFirst({
      where: and(
        eq(divisions.stageId, stage.id),
        eq(divisions.urlSlug, data.divUrlSlug),
      ),
      with: {
        teams: {
          orderBy: (team, { asc }) => [asc(team.name)],
        },
        games: {
          orderBy: (game, { asc }) => [asc(game.startTime), asc(game.id)],
          with: {
            teamA: true,
            teamB: true,
            gameSets: {
              with: {
                court: {
                  with: {
                    venue: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return {
      competition,
      stage,
      division,
    }
  })

export const Route = createFileRoute('/competition/$competitionUrlSlug/stg/$stageUrlSlug/$divUrlSlug')({
  loader: async ({ params }) =>
    loadDivisionSchedule({
      data: {
        competitionUrlSlug: params.competitionUrlSlug,
        stageUrlSlug: params.stageUrlSlug,
        divUrlSlug: params.divUrlSlug,
      },
    }),
  component: DivisionSchedulePage,
})

function formatTime(date: Date | null): string {
  if (!date) return '--:--'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  }).format(date)
}

function formatDate(date: Date | null): string {
  if (!date) return '--'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/London',
  }).format(date)
}

function DivisionSchedulePage() {
  const data = Route.useLoaderData()

  if (!data.competition) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Competition not found</h1>
        <p className="text-body-secondary mb-0">No competition exists for this slug.</p>
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

  const colorByTeamId = new Map<number, string>()
  data.division.teams.forEach((team, index) => {
    colorByTeamId.set(team.id, TEAM_COLOR_CLASSES[index % TEAM_COLOR_CLASSES.length])
  })

  return (
    <section className="container py-4">
      <header className="mb-4">
        <p className="text-body-secondary mb-1">{data.competition.name}</p>
        <h1 className="h2 mb-1">
          {data.stage.name} - {data.division.name}
        </h1>
        <p className="mb-0 text-body-secondary">Game schedule</p>
      </header>

      {data.division.games.length === 0 ? (
        <p className="text-body-secondary mb-0">No games scheduled for this division yet.</p>
      ) : (
        <div className="row g-3 g-lg-4 row-cols-1 row-cols-lg-2">
          {data.division.games.map((game) => {
            const firstSet = game.gameSets[0]
            const teamAColor = colorByTeamId.get(game.teamA.id) ?? 'team-a'
            const teamBColor = colorByTeamId.get(game.teamB.id) ?? 'team-b'

            return (
              <div className="col" key={game.id}>
                <article className="card h-100 shadow-sm">
                  <div className="card-body d-flex flex-column gap-3">
                    <header className="d-flex justify-content-between align-items-center">
                      <span className="badge badge-banana-subtle">{formatDate(game.startTime)}</span>
                      <span className="small text-body-secondary">
                        {formatTime(game.startTime)} - {formatTime(game.endTime)}
                      </span>
                    </header>

                    <div className="d-flex flex-column gap-2">
                      <div className={`badge team-badge team-badge-strong ${teamAColor} text-start py-2`}>
                        {game.teamA.name}
                      </div>
                      <div className={`badge team-badge team-badge-strong ${teamBColor} text-start py-2`}>
                        {game.teamB.name}
                      </div>
                    </div>

                    <footer className="small text-body-secondary mt-auto">
                      Court: {firstSet?.court?.name ?? 'TBD'}
                      {firstSet?.court?.venue?.name ? ` (${firstSet.court.venue.name})` : ''}
                    </footer>
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
