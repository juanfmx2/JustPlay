import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '../../../../../../../db/client'
import { competitions, divisions, organizations, stages } from '../../../../../../../schema'

type TeamPalette = {
  background: string
  border: string
}

const TEAM_PASTEL_PALETTE: TeamPalette[] = [
  { background: '#ffd6dd', border: '#df97a7' },
  { background: '#ffe9bf', border: '#d9b16d' },
  { background: '#d2f0d8', border: '#86bc90' },
  { background: '#d3ebff', border: '#82b3db' },
  { background: '#dfd6ff', border: '#a698d9' },
  { background: '#ffd7ed', border: '#d396b8' },
  { background: '#d7f7f4', border: '#90c7c1' },
  { background: '#f3e7d6', border: '#c8aa86' },
]

const loadDivisionSchedule = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: {
      orgUrlSlug: string
      competitionUrlSlug: string
      stageUrlSlug: string
      divUrlSlug: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })

    if (!organization) {
      return { organization: null, competition: null, stage: null, division: null }
    }

    const competition = await db.query.competitions.findFirst({
      where: and(
        eq(competitions.organizationId, organization.id),
        eq(competitions.urlSlug, data.competitionUrlSlug),
      ),
    })

    if (!competition) {
      return { organization, competition: null, stage: null, division: null }
    }

    const stage = await db.query.stages.findFirst({
      where: and(
        eq(stages.competitionId, competition.id),
        eq(stages.urlSlug, data.stageUrlSlug),
      ),
    })

    if (!stage) {
      return { organization, competition, stage: null, division: null }
    }

    const division = await db.query.divisions.findFirst({
      where: and(eq(divisions.stageId, stage.id), eq(divisions.urlSlug, data.divUrlSlug)),
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
      organization,
      competition,
      stage,
      division,
    }
  })

export const Route = createFileRoute('/org/$orgUrlSlug/competition/$competitionUrlSlug/stg/$stageUrlSlug/$divUrlSlug')({
  loader: async ({ params }) =>
    loadDivisionSchedule({
      data: {
        orgUrlSlug: params.orgUrlSlug,
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

  const uniqueTeamsFromGames = Array.from(
    new Map(
      data.division.games
        .flatMap((game) => [game.teamA, game.teamB])
        .map((team) => [team.id, team] as const),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const colorByTeamId = new Map<number, TeamPalette>()
  uniqueTeamsFromGames.forEach((team, index) => {
    colorByTeamId.set(team.id, TEAM_PASTEL_PALETTE[index % TEAM_PASTEL_PALETTE.length])
  })

  return (
    <section className="container py-4">
      <header className="mb-4">
        <p className="text-body-secondary mb-1">{data.organization.name} / {data.competition.name}</p>
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
            const teamAColor = colorByTeamId.get(game.teamA.id) ?? TEAM_PASTEL_PALETTE[0]
            const teamBColor = colorByTeamId.get(game.teamB.id) ?? TEAM_PASTEL_PALETTE[1]

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
                      <div
                        className="badge text-start py-2"
                        style={{
                          backgroundColor: teamAColor.background,
                          border: `1px solid ${teamAColor.border}`,
                          color: '#2b2b2b',
                        }}
                      >
                        {game.teamA.name}
                      </div>
                      <div
                        className="badge text-start py-2"
                        style={{
                          backgroundColor: teamBColor.background,
                          border: `1px solid ${teamBColor.border}`,
                          color: '#2b2b2b',
                        }}
                      >
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
