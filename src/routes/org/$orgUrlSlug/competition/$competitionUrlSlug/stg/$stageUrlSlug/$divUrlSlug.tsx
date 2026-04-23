import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '@/db/client'
import { competitions, organizations, 
  stages,
  CourtWithVenue, getCourtAndVenue, 
  Organization, Stage, Competition,
  DivisionWithTeamsGamesAndSets } from '@/schema'
import { getDivisionWithTeamsAndGames } from '@/schema/queries/division'
import '@/styles/print-schedules.css'
import '@/styles/division-schedule.css'

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
  { background: '#ffe9bf', border: '#d9b16d' },
  { background: '#ffd6dd', border: '#df97a7' },
  { background: '#d2f0d8', border: '#86bc90' },
  { background: '#d3ebff', border: '#82b3db' },
  { background: '#dfd6ff', border: '#a698d9' },
  { background: '#ffd7ed', border: '#d396b8' },
  { background: '#d7f7f4', border: '#90c7c1' },
  { background: '#f3e7d6', border: '#c8aa86' },
]

const PALETTE_CLASS_BY_INDEX = TEAM_PASTEL_PALETTE.map((_, index) => `division-schedule-palette-${index}`)

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

  let bananaTeam = null
  const uniqueTeamsFromGames = Array.from(
    new Map(
      data.division.games
        .flatMap((game) => [game.teamA, game.teamB, game.reffingTeam].filter((team) => team !== null))
        .map((team) => [team.id, team] as const),
    ).values(),
  ).sort((a, b) => {
    if(a.name.toLowerCase().startsWith('banana')) 
      bananaTeam = a
    return a.name.localeCompare(b.name)
  })

  console.log('Banana Team:', bananaTeam)
  if (bananaTeam ){
    const indexOfBananaTeam = uniqueTeamsFromGames.indexOf(bananaTeam);
    if (indexOfBananaTeam > 0) {
      uniqueTeamsFromGames.splice(indexOfBananaTeam, 1)
      uniqueTeamsFromGames.unshift
    }
  }
  console.log('Unique Teams from Games:', uniqueTeamsFromGames)


  const paletteClassByTeamId = new Map<number, string>()
  uniqueTeamsFromGames.forEach((team, index) => {
    console.log(`Assigning palette to team ${team.name} (ID: ${team.id}) COLOR: ${PALETTE_CLASS_BY_INDEX[index % PALETTE_CLASS_BY_INDEX.length]}`)
    paletteClassByTeamId.set(team.id, PALETTE_CLASS_BY_INDEX[index % PALETTE_CLASS_BY_INDEX.length])
  })

  const firstReffingTeam = data.division.games.find((game) => Boolean(game.reffingTeam))?.reffingTeam ?? null
  const firstReffingTeamPaletteClass = firstReffingTeam
    ? (paletteClassByTeamId.get(firstReffingTeam.id) ?? 'division-schedule-palette-2')
    : ''

  return (
    <section className="container py-4 schedule-print-root">

      <header>
        <div className="mb-4 d-flex flex-column flex-lg-row align-items-start gap-3">
          <div className="flex-grow-1">
            <h2>
              {data.stage.name} - {data.division.name}
            </h2>
            <h2>
              Game schedule
            </h2>
            {data.mostCommonDate && (
              <p><b>Date:</b> {formatDate(data.mostCommonDate)}</p>
            )}
            {data.mostCommonCourtName && (
              <p><b>Place:</b> {data.mostCommonCourtName}</p>
            )}
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 no-print align-self-stretch align-self-lg-auto justify-content-start justify-content-lg-end ms-lg-auto flex-shrink-0">
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
            className={`badge ms-2 division-schedule-warning-team ${firstReffingTeamPaletteClass}`}
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
            const teamAPaletteClass = paletteClassByTeamId.get(game.teamA.id) ?? 'division-schedule-palette-0'
            const teamBPaletteClass = paletteClassByTeamId.get(game.teamB.id) ?? 'division-schedule-palette-1'
            const refTeamPaletteClass = game.reffingTeam
              ? (paletteClassByTeamId.get(game.reffingTeam.id) ?? 'division-schedule-palette-2')
              : ''

            return (
              <article className="card shadow-sm" key={game.id}>
                <div className="card-body d-flex flex-column flex-md-row gap-3 align-items-stretch">
                  <aside
                    className="d-flex flex-row flex-md-column text-center flex-shrink-0 division-schedule-game-time-column"
                  >
                    <div className={`division-schedule-time-slot ${halfTime ? 'division-schedule-time-slot-with-half' : ''}`}>
                      <div className="small text-body-secondary text-uppercase division-schedule-time-label">Start</div>
                      <div className="fw-semibold division-schedule-time-value">{formatTime(game.startTime)}</div>
                    </div>
                    {halfTime && (
                      <div className="division-schedule-time-slot division-schedule-time-half">
                        <div className="small text-body-secondary text-uppercase division-schedule-time-label">Half</div>
                        <div className="fw-semibold division-schedule-time-value">{formatTime(halfTime)}</div>
                      </div>
                    )}
                    <div className="division-schedule-time-slot">
                      <div className="small text-body-secondary text-uppercase division-schedule-time-label">End</div>
                      <div className="fw-semibold division-schedule-time-value">{formatTime(game.endTime)}</div>
                    </div>
                  </aside>

                  <div className="d-flex flex-column gap-3 flex-grow-1 division-schedule-game-content">
                    <header className="d-flex justify-content-end align-items-center">
                      {data?.mostCommonDate && !sameDay(firstSet?.startTime, data.mostCommonDate) && (
                        <span className="badge badge-banana-subtle">{formatDate(game.startTime)}</span>
                      )}
                    </header>

                    <div className="d-flex align-items-stretch justify-content-between gap-2">
                      <div
                        className={`badge text-center py-2 d-flex flex-column h-100 division-schedule-team-badge ${teamAPaletteClass}`}
                      >
                        <div className="flex-grow-1 d-flex align-items-center justify-content-center">{game.teamA.name}</div>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={game.scoreTeamA ?? undefined}
                          className="form-control form-control-sm mt-2 division-schedule-score-input"
                          aria-label={`Score for ${game.teamA.name}`}
                          disabled
                        />
                      </div>
                      <div className="d-flex align-items-center fw-semibold text-body-secondary px-1">vs</div>
                      <div
                        className={`badge text-center py-2 d-flex flex-column h-100 division-schedule-team-badge ${teamBPaletteClass}`}
                      >
                        <div className="flex-grow-1 d-flex align-items-center justify-content-center">{game.teamB.name}</div>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={game.scoreTeamB ?? undefined}
                          className="form-control form-control-sm mt-2 division-schedule-score-input"
                          aria-label={`Score for ${game.teamB.name}`}
                          disabled
                        />
                      </div>
                    </div>

                    <div
                      className={`badge text-start py-2 division-schedule-ref-badge ${refTeamPaletteClass}`}
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
