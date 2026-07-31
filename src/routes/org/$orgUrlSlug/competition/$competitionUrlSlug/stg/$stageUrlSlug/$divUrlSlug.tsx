import { and, eq } from 'drizzle-orm'
import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db/client'
import { competitions, organizations, 
  stages,
  CourtWithVenue, getCourtAndVenue, 
  Organization, Stage, Competition,
  DivisionWithTeamsGamesAndSets
} from '@/schema'
import { getDivisionWithTeamsAndGames } from '@/schema/queries/division'
import { applyGameSetScoreAndUpdateStandings } from '@/domain/scorer'
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

const submitScore = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      gameSetId: number
      scoreTeamA: number
      scoreTeamB: number
    }) => input,
  )
  .handler(async ({ data }) => {
    await applyGameSetScoreAndUpdateStandings({
      gameSetId: data.gameSetId,
      scoreTeamA: data.scoreTeamA,
      scoreTeamB: data.scoreTeamB,
    })
    return { success: true }
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

type SetWinner = 'A' | 'B' | 'DRAW'

const SCORE_UPDATE_COOLDOWN_MS = 5 * 60 * 1000


const calculateIsInCooldown = (lastUpdatedMs:number|null, nowMs: number): boolean => {
  return lastUpdatedMs !== null && Number.isFinite(lastUpdatedMs) && nowMs - lastUpdatedMs < SCORE_UPDATE_COOLDOWN_MS
}

interface GameCardProps {
  game: any
  teamAPaletteClass: string
  teamBPaletteClass: string
  refTeamPaletteClass: string
  mostCommonDate: Date | null
  mostCommonCourt: CourtWithVenue | null
  submittingGameId: number | null
  onSubmitGameId: (id: number | null) => void
}

function GameCard({ game, teamAPaletteClass, teamBPaletteClass, refTeamPaletteClass, mostCommonDate, mostCommonCourt, submittingGameId, onSubmitGameId }: GameCardProps) {
  const sortedGameSets = React.useMemo(
    () =>
      [...game.gameSets].sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER
        const timeB = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER
        if (timeA !== timeB) return timeA - timeB
        return a.id - b.id
      }),
    [game.gameSets],
  )

  const firstSet = sortedGameSets[0]

  const [scoresBySetId, setScoresBySetId] = React.useState<Record<number, { scoreA: number; scoreB: number }>>(
    () =>
      Object.fromEntries(
        sortedGameSets.map((set) => [set.id, { scoreA: set.scoreTeamA ?? 0, scoreB: set.scoreTeamB ?? 0 }]),
      ),
  )
  const [lastUpdatedBySetId, setLastUpdatedBySetId] = React.useState<Record<number, number | null>>(
    () =>
      Object.fromEntries(
        sortedGameSets.map((set) => [set.id, set?.lastUpdated ? new Date(set.lastUpdated).getTime() : null]),
      ),
  )
  const [savedWinnerBySetId, setSavedWinnerBySetId] = React.useState<Record<number, SetWinner>>({})
  const [nowMs, setNowMs] = React.useState(() => Date.now())

  const updateSetScore = (setId: number, side: 'A' | 'B', value: string) => {
    const parsed = Number(value)
    const nextValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    setScoresBySetId((previous) => {
      const current = previous[setId] ?? { scoreA: 0, scoreB: 0 }
      return {
        ...previous,
        [setId]: side === 'A'
          ? { ...current, scoreA: nextValue }
          : { ...current, scoreB: nextValue },
      }
    })
  }

  const setStates = sortedGameSets.map((set) => {
    const now = new Date()
    const setEnded = Boolean(set?.endTime && new Date(set.endTime) < now)
    const dayEnded = Boolean(
      set?.endTime && new Date(set.endTime).setHours(22, 30, 0, 0) < now.getTime(),
    )
    const lastUpdatedMs = lastUpdatedBySetId[set.id] ?? null
    const isInCooldown = calculateIsInCooldown(lastUpdatedMs, nowMs)
    return {
      set,
      setEnded,
      dayEnded,
      isInCooldown,
      scores: scoresBySetId[set.id] ?? { scoreA: 0, scoreB: 0 },
    }
  })

  const hasAnyCooldown = setStates.some((state) => state.isInCooldown)
  const hasAnyDayLock = setStates.some((state) => state.dayEnded)
  const allSetsEnded = setStates.every((state) => state.setEnded)
  const isSavingThisGame = submittingGameId === game.id

  React.useEffect(() => {
    if (!hasAnyCooldown) return
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 10000)
    return () => window.clearInterval(interval)
  }, [hasAnyCooldown])

  const saveAllSetsForMatch = async () => {
    if (!allSetsEnded || hasAnyDayLock || isSavingThisGame) return

    onSubmitGameId(game.id)
    try {
      for (const state of setStates) {
        await submitScore({
          data: {
            gameSetId: state.set.id,
            scoreTeamA: state.scores.scoreA,
            scoreTeamB: state.scores.scoreB,
          },
        })
      }

      const updatedAt = Date.now()
      setLastUpdatedBySetId((previous) => {
        const next = { ...previous }
        for (const state of setStates) {
          next[state.set.id] = updatedAt
        }
        return next
      })

      const winnerBySet: Record<number, SetWinner> = {}
      for (const state of setStates) {
        if (state.scores.scoreA > state.scores.scoreB) {
          winnerBySet[state.set.id] = 'A'
        } else if (state.scores.scoreB > state.scores.scoreA) {
          winnerBySet[state.set.id] = 'B'
        } else {
          winnerBySet[state.set.id] = 'DRAW'
        }
      }
      setSavedWinnerBySetId(winnerBySet)
    } finally {
      onSubmitGameId(null)
    }
  }

  const saveButtonLabel = !allSetsEnded
    ? 'Please Wait'
    : hasAnyDayLock
      ? 'Locked after 22:30'
      : hasAnyCooldown
        ? 'Updated Successfully'
        : isSavingThisGame
          ? 'Saving...'
          : 'Save'

  return (
    <article className="card shadow-sm" key={game.id}>
      <div className="card-body d-flex flex-column flex-md-row gap-3 align-items-stretch">
        <aside
          className="d-flex flex-row flex-md-column text-center flex-shrink-0 division-schedule-game-time-column"
        >
          <div className={`division-schedule-time-slot`}>
            <div className="small text-body-secondary text-uppercase division-schedule-time-label">Start</div>
            <div className="fw-semibold division-schedule-time-value">{formatTime(game.startTime)}</div>
          </div>
            
        </aside>

        <div className="d-flex flex-column gap-3 flex-grow-1 division-schedule-game-content">
          <header className="d-flex justify-content-end align-items-center">
            {mostCommonDate && !sameDay(firstSet?.startTime, mostCommonDate) && (
              <span className="badge badge-banana-subtle">{formatDate(game.startTime)}</span>
            )}
          </header>

          <div className="d-flex align-items-stretch justify-content-between gap-2">
            <div
              className={`badge text-center py-2 d-flex flex-column h-100 division-schedule-team-badge ${teamAPaletteClass}`}
            >
              <div className="flex-grow-1 d-flex align-items-center justify-content-center">{game.teamA.name}</div>
                {setStates.map(({ set, dayEnded, scores }, setIndex) => {
                const savedWinner = savedWinnerBySetId[set.id]
                const teamAHighlightClass =
                  savedWinner === 'A'
                    ? 'bg-success-subtle border-success'
                    : savedWinner === 'B'
                      ? 'bg-danger-subtle border-danger'
                      : ''
                return <React.Fragment key={set.id}>
                  <input
                      type="number"
                      min={0}
                      step={1}
                      value={scores.scoreA}
                      onChange={(e) => updateSetScore(set.id, 'A', e.target.value)}
                      className={`form-control form-control-sm mt-2 division-schedule-score-input text-center fs-5 ${teamAHighlightClass}`}
                      aria-label={`Set ${setIndex + 1} score for ${game.teamA.name}`}
                      disabled={dayEnded}
                    />
                </React.Fragment>
              })}
              </div>
            <div className="d-flex align-items-center fw-semibold text-body-secondary px-1">vs</div>
            <div
              className={`badge text-center py-2 d-flex flex-column h-100 division-schedule-team-badge ${teamBPaletteClass}`}
            >
              <div className="flex-grow-1 d-flex align-items-center justify-content-center">{game.teamB.name}</div>
               {setStates.map(({ set, dayEnded, scores }, setIndex) => {
                const savedWinner = savedWinnerBySetId[set.id]
                const teamBHighlightClass =
                  savedWinner === 'B'
                    ? 'bg-success-subtle border-success'
                    : savedWinner === 'A'
                      ? 'bg-danger-subtle border-danger'
                      : ''
                return <React.Fragment key={set.id}>
                  <input
                      type="number"
                      min={0}
                      step={1}
                      value={scores.scoreB}
                      onChange={(e) => updateSetScore(set.id, 'B', e.target.value)}
                      className={`form-control form-control-sm mt-2 division-schedule-score-input text-center fs-5 ${teamBHighlightClass}`}
                      aria-label={`Set ${setIndex + 1} score for ${game.teamB.name}`}
                      disabled={dayEnded}
                    />
                </React.Fragment>
              })}
            </div>
          </div>

          <div className="d-flex justify-content-end no-print">
            <button
              type="button"
              className="btn btn-sm btn-banana"
              onClick={saveAllSetsForMatch}
              disabled={isSavingThisGame || hasAnyCooldown || !allSetsEnded || hasAnyDayLock}
            >
              {saveButtonLabel}
            </button>
          </div>

          <div
            className={`badge text-start py-2 flex-grow-1 division-schedule-ref-badge ${refTeamPaletteClass}`}
          >
            Ref: {game.reffingTeam?.name ?? 'TBD'}
          </div>
          {mostCommonCourt?.id && firstSet?.courtId !== mostCommonCourt?.id && (
            <footer className="small text-body-secondary mt-auto">
              Court: {getCourtAndVenue(firstSet?.court)}
            </footer>
          )}
        </div>
      </div>
    </article>
  )
}

function DivisionSchedulePage() {
  const data = Route.useLoaderData()
  const [submittingGameId, setSubmittingGameId] = React.useState<number | null>(null)

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
    else if(b.name.toLowerCase().startsWith('banana'))
      bananaTeam = b
    return a.name.localeCompare(b.name)
  })

  console.log('Banana Team:', bananaTeam)
  if (bananaTeam ){
    const indexOfBananaTeam = uniqueTeamsFromGames.indexOf(bananaTeam);
    if (indexOfBananaTeam > 0) {
      uniqueTeamsFromGames.splice(indexOfBananaTeam, 1)
      uniqueTeamsFromGames.unshift(bananaTeam)
    }
  }
  console.log('Unique Teams from Games:', uniqueTeamsFromGames)


  const paletteClassByTeamId = new Map<number, string>()
  uniqueTeamsFromGames.forEach((team, index) => {
    console.log(`Assigning palette to team ${team.name} (ID: ${team.id}) COLOR: ${PALETTE_CLASS_BY_INDEX[index % PALETTE_CLASS_BY_INDEX.length]}`)
    paletteClassByTeamId.set(team.id, PALETTE_CLASS_BY_INDEX[index % PALETTE_CLASS_BY_INDEX.length])
  })

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
              href={`/org/${data.organization.urlSlug}/competition/${data.competition.urlSlug}/stg/${data.stage.urlSlug}/standings/${data.division.urlSlug ?? ''}`}
            >
              Standings
            </a>
            <a
              className="btn btn-outline-secondary"
              href={`/org/${data.organization.urlSlug}/competition/${data.competition.urlSlug}#${data.stage.urlSlug ?? ''}`}
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
        <span>
          <span className="fw-semibold">Warning: </span>
          The <b>Schedule below</b> is subject to change. Please wait for referees and previous game to finish.
        </span>
      </div>

      {data.division.games.length === 0 ? (
        <p className="text-body-secondary mb-0">No games scheduled for this division yet.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {data.division.games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              teamAPaletteClass={paletteClassByTeamId.get(game.teamA.id) ?? 'division-schedule-palette-0'}
              teamBPaletteClass={paletteClassByTeamId.get(game.teamB.id) ?? 'division-schedule-palette-1'}
              refTeamPaletteClass={game.reffingTeam ? (paletteClassByTeamId.get(game.reffingTeam.id) ?? 'division-schedule-palette-2') : ''}
              mostCommonDate={data.mostCommonDate}
              mostCommonCourt={data.mostCommonCourt}
              submittingGameId={submittingGameId}
              onSubmitGameId={setSubmittingGameId}
            />
          ))}
        </div>
      )}
    </section>
  )
}
