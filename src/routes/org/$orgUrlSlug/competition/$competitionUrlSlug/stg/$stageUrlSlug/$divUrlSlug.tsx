import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '../../../../../../../db/client'
import { competitions, organizations, 
  stages,
  CourtWithVenue, getCourtAndVenue, 
  Organization, Stage, Competition,
  DivisionWithTeamsGamesAndSets } from '../../../../../../../schema'
import { getDivisionWithTeamsAndGames } from '../../../../../../../schema/queries/division'
import '../../../../../../../styles/print-schedules.css'

type TeamPalette = {
  background: string
  border: string
}

type LoaderData = {
  organization: Organization | null
  competition: Competition | null
  stage: Stage | null
  division: DivisionWithTeamsGamesAndSets | null
  mostCommonDate: Date | null
  mostCommonCourt: CourtWithVenue | null
  mostCommonCourtName: string | null
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
        mostCommonDate: null,
        mostCommonCourt: null,
        mostCommonCourtName: null,
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
        mostCommonDate: null,
        mostCommonCourt: null,
        mostCommonCourtName: null,
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
        mostCommonDate: null,
        mostCommonCourt: null,
        mostCommonCourtName: null,
      }
    }

    const division = await getDivisionWithTeamsAndGames({
      stageUrlSlug: data.stageUrlSlug,
      divUrlSlug: data.divUrlSlug,
    })
    
    let mostCommonDate: Date | null = null;
    let mostCommonCourt: CourtWithVenue | null = null;
    const dateCounts: Record<string, number> = {};
    const courtCountsById: Record<number, number> = {};
    division?.games.forEach((game) => {
      const dateKey = game?.startTime?.toISOString().split('T')[0]
      if (!dateKey) return
      dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1
      if (!mostCommonDate || dateCounts[dateKey] > dateCounts[mostCommonDate.toISOString().split('T')[0]]) {
        mostCommonDate = new Date(dateKey)
      }

      game.gameSets.forEach((gameSet) => {
        if (!gameSet.court) return
        courtCountsById[gameSet.court.id] = (courtCountsById[gameSet.court.id] || 0) + 1
        if (!mostCommonCourt || courtCountsById[gameSet.court.id] > courtCountsById[mostCommonCourt.id]) {
          mostCommonCourt = gameSet.court
        }
      })
    })

    return {
      organization,
      competition,
      stage,
      division,
      mostCommonDate,
      mostCommonCourt,
      mostCommonCourtName: mostCommonCourt ? getCourtAndVenue(mostCommonCourt) : null
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
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    timeZone: 'Europe/London',
  }).format(date)
}

function sameDay(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
}

function getHalfTime(startTime: Date | null, endTime: Date | null): Date | null {
  if (!startTime || !endTime) return null

  const diffMs = endTime.getTime() - startTime.getTime()
  if (diffMs <= 15 * 60 * 1000) return null

  return new Date(startTime.getTime() + Math.floor(diffMs / 2))
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
        .flatMap((game) => [game.teamA, game.teamB, game.reffingTeam].filter((team) => team !== null))
        .map((team) => [team.id, team] as const),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const colorByTeamId = new Map<number, TeamPalette>()
  uniqueTeamsFromGames.forEach((team, index) => {
    colorByTeamId.set(team.id, TEAM_PASTEL_PALETTE[index % TEAM_PASTEL_PALETTE.length])
  })

  const firstReffingTeam = data.division.games.find((game) => Boolean(game.reffingTeam))?.reffingTeam ?? null
  const firstReffingTeamColor = firstReffingTeam
    ? (colorByTeamId.get(firstReffingTeam.id) ?? TEAM_PASTEL_PALETTE[2])
    : null

  return (
    <section className="container py-4 schedule-print-root">

      <header>
        <div className="mb-4 d-flex justify-content-between align-items-end gap-3">
          <div>
            <h2 className="h2 mb-1">
              {data.stage.name} - {data.division.name} - Game schedule
            </h2>
            {/* <h3 className="h3 mb-1"></h3> */}
            
            {data.mostCommonDate && (
              <p><b>Date:</b> {formatDate(data.mostCommonDate)}</p>
            )}
            {data.mostCommonCourtName && (
              <p><b>Place:</b> {data.mostCommonCourtName}</p>
            )}
          </div>
          <div className="d-flex align-items-center gap-2 no-print">
            <a
              className="btn btn-outline-secondary"
              href={`/org/${data.organization.urlSlug}/competition/${data.competition.urlSlug}`}
            >
              Back to Competition
            </a>
            <button className="btn btn-banana btn-outline-secondary" type="button" onClick={() => window.print()}>
              Print PDF
            </button>
          </div>
        </div>
      </header>

      <div className="alert alert-warning d-flex align-items-center gap-2 no-print" role="alert">
        <span className="fw-semibold">Warning:</span>
        <span>
          The first team reffing
          <span
            className="badge ms-2"
            style={{
              backgroundColor: firstReffingTeamColor?.background ?? '#e9ecef',
              border: `1px solid ${firstReffingTeamColor?.border ?? '#cfd4da'}`,
              color: '#2b2b2b',
            }}
          >
            {firstReffingTeam?.name ?? 'TBD'}
          </span>
          {' '}needs to bring a printed copy of this scoresheet.
        </span>
      </div>

      {data.division.games.length === 0 ? (
        <p className="text-body-secondary mb-0">No games scheduled for this division yet.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {data.division.games.map((game) => {
            const firstSet = game.gameSets[0]
            const halfTime = getHalfTime(game.startTime, game.endTime)
            const teamAColor = colorByTeamId.get(game.teamA.id) ?? TEAM_PASTEL_PALETTE[0]
            const teamBColor = colorByTeamId.get(game.teamB.id) ?? TEAM_PASTEL_PALETTE[1]
            const refTeamColor = game.reffingTeam
              ? (colorByTeamId.get(game.reffingTeam.id) ?? TEAM_PASTEL_PALETTE[2])
              : null

            return (
              <article className="card shadow-sm" key={game.id}>
                <div className="card-body d-flex gap-3 align-items-stretch">
                  <aside
                    className="d-flex flex-column justify-content-center text-center border-end pe-3 flex-shrink-0"
                    style={{ width: '5.5rem' }}
                  >
                    <div className={`py-2 ${halfTime ? 'border-bottom' : ''}`}>
                      <div className="small text-body-secondary text-uppercase">Start</div>
                      <div className="fw-semibold">{formatTime(game.startTime)}</div>
                    </div>
                    {halfTime && (
                      <div className="py-2 border-bottom">
                        <div className="small text-body-secondary text-uppercase">Half</div>
                        <div className="fw-semibold">{formatTime(halfTime)}</div>
                      </div>
                    )}
                    <div className="py-2">
                      <div className="small text-body-secondary text-uppercase">End</div>
                      <div className="fw-semibold">{formatTime(game.endTime)}</div>
                    </div>
                  </aside>

                  <div className="d-flex flex-column gap-3 flex-grow-1" style={{ minWidth: 0 }}>
                    <header className="d-flex justify-content-end align-items-center">
                      {data?.mostCommonDate && !sameDay(firstSet?.startTime, data.mostCommonDate) && (
                        <span className="badge badge-banana-subtle">{formatDate(game.startTime)}</span>
                      )}
                    </header>

                    <div className="d-flex align-items-stretch justify-content-between gap-2">
                      <div
                        className="badge text-center py-2 d-flex flex-column h-100"
                        style={{
                          backgroundColor: teamAColor.background,
                          border: `1px solid ${teamAColor.border}`,
                          color: '#2b2b2b',
                          flex: '1 1 0',
                          minWidth: 0,
                          minHeight: '6.75rem',
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        <div className="flex-grow-1 d-flex align-items-center justify-content-center">{game.teamA.name}</div>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={game.scoreTeamA ?? undefined}
                          className="form-control form-control-sm mt-2"
                          style={{ height: '3.35rem' }}
                          aria-label={`Score for ${game.teamA.name}`}
                          disabled
                        />
                      </div>
                      <div className="d-flex align-items-center fw-semibold text-body-secondary px-1">vs</div>
                      <div
                        className="badge text-center py-2 d-flex flex-column h-100"
                        style={{
                          backgroundColor: teamBColor.background,
                          border: `1px solid ${teamBColor.border}`,
                          color: '#2b2b2b',
                          flex: '1 1 0',
                          minWidth: 0,
                          minHeight: '6.75rem',
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        <div className="flex-grow-1 d-flex align-items-center justify-content-center">{game.teamB.name}</div>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={game.scoreTeamB ?? undefined}
                          className="form-control form-control-sm mt-2"
                          style={{ height: '3.35rem' }}
                          aria-label={`Score for ${game.teamB.name}`}
                          disabled
                        />
                      </div>
                    </div>

                    <div
                      className="badge text-start py-2"
                      style={{
                        backgroundColor: refTeamColor?.background ?? '#e9ecef',
                        border: `1px solid ${refTeamColor?.border ?? '#cfd4da'}`,
                        color: '#2b2b2b',
                      }}
                    >
                      Ref: {game.reffingTeam?.name ?? 'TBD'}
                    </div>
                    { data?.mostCommonCourt?.id && firstSet?.courtId !== data?.mostCommonCourt?.id && (
                      <footer className="small text-body-secondary mt-auto">
                        Court: {getCourtAndVenue(firstSet?.court)}
                      </footer>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
