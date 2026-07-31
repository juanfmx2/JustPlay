import { and, eq } from 'drizzle-orm'
import React from 'react'
import { Modal } from 'react-bootstrap'
import { CheckCircleFill, ShieldCheck, ShieldExclamation } from 'react-bootstrap-icons'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db/client'
import { competitions, organizations,
  stages,
  games,
  CourtWithVenue, getCourtAndVenue,
  Organization, Stage, Competition,
  DivisionWithTeamsGamesAndSets,
  Game,
} from '@/schema'
import { getDivisionWithTeamsAndGames } from '@/schema/queries/division'
import {
  applyGameSetScoreAndUpdateStandings,
  finishGame,
  approveGameForTeam,
  validateGameByAdmin,
} from '@/domain/scorer'
import { getSessionPrincipal, type AuthPrincipal } from '@/server/auth.server'
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
  principal: AuthPrincipal | null
}

type GameApprovalFields = Pick<
  Game,
  'finishedAt' | 'teamAApprovedAt' | 'teamBApprovedAt' | 'adminValidatedAt' | 'adminValidatedByName'
>

async function assertCanManageGame(principal: AuthPrincipal | null, gameId: number): Promise<void> {
  if (principal?.type === 'admin') return

  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
    with: { reffingTeam: true },
  })

  if (!game) throw new Error(`Game #${gameId} was not found.`)

  const isReferee = principal?.type === 'team' && principal.name === game.reffingTeam?.name
  if (!isReferee) {
    throw new Error('Only the referee team or an admin can manage this game.')
  }
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
    const principal = await getSessionPrincipal()

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
        principal,
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
        principal,
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
        principal,
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
      mostCommonCourtName: mostCommonCourt ? getCourtAndVenue(mostCommonCourt) : null,
      principal,
    }
  })

const submitScore = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      gameId: number
      gameSetId: number
      scoreTeamA: number
      scoreTeamB: number
    }) => input,
  )
  .handler(async ({ data }) => {
    const principal = await getSessionPrincipal()
    await assertCanManageGame(principal, data.gameId)

    await applyGameSetScoreAndUpdateStandings({
      gameSetId: data.gameSetId,
      scoreTeamA: data.scoreTeamA,
      scoreTeamB: data.scoreTeamB,
    })
    return { success: true }
  })

const finishGameServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { gameId: number }) => input)
  .handler(async ({ data }): Promise<GameApprovalFields> => {
    const principal = await getSessionPrincipal()
    await assertCanManageGame(principal, data.gameId)

    return finishGame(data.gameId)
  })

const approveGameServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { gameId: number; team: 'A' | 'B' }) => input)
  .handler(async ({ data }): Promise<GameApprovalFields> => {
    const principal = await getSessionPrincipal()

    const game = await db.query.games.findFirst({
      where: eq(games.id, data.gameId),
      with: { teamA: true, teamB: true },
    })
    if (!game) throw new Error(`Game #${data.gameId} was not found.`)

    const expectedTeamName = data.team === 'A' ? game.teamA.name : game.teamB.name
    const isCorrectTeam = principal?.type === 'team' && principal.name === expectedTeamName
    if (!isCorrectTeam) {
      throw new Error('Only the participating team can approve this result while logged in as that team.')
    }

    return approveGameForTeam(data.gameId, data.team)
  })

const validateGameServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { gameId: number }) => input)
  .handler(async ({ data }): Promise<GameApprovalFields> => {
    const principal = await getSessionPrincipal()
    if (principal?.type !== 'admin') {
      throw new Error('Only an admin can validate this result.')
    }

    return validateGameByAdmin(data.gameId, principal.name)
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
  matchNumber: number
  principal: AuthPrincipal | null
  teamAPaletteClass: string
  teamBPaletteClass: string
  refTeamPaletteClass: string
  mostCommonDate: Date | null
  mostCommonCourt: CourtWithVenue | null
  submittingGameId: number | null
  onSubmitGameId: (id: number | null) => void
}

function GameCard({ game, matchNumber, principal, teamAPaletteClass, teamBPaletteClass, refTeamPaletteClass, mostCommonDate, mostCommonCourt, submittingGameId, onSubmitGameId }: GameCardProps) {
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
  const [savedWinnerBySetId, setSavedWinnerBySetId] = React.useState<Record<number, SetWinner>>(
    () =>
      Object.fromEntries(
        sortedGameSets
          .filter((set) => set.scoreTeamA !== null && set.scoreTeamB !== null)
          .map((set) => {
            const winner: SetWinner =
              set.scoreTeamA > set.scoreTeamB ? 'A' : set.scoreTeamB > set.scoreTeamA ? 'B' : 'DRAW'
            return [set.id, winner]
          }),
      ),
  )
  const [nowMs, setNowMs] = React.useState(() => Date.now())

  // Tracks the exact values last persisted per set, so we can tell a set
  // apart that's "saved" from one that merely was saved once with a
  // different (e.g. placeholder) value and has since been edited again.
  const [savedScoresBySetId, setSavedScoresBySetId] = React.useState<Record<number, { scoreA: number; scoreB: number }>>(
    () =>
      Object.fromEntries(
        sortedGameSets
          .filter((set) => set.scoreTeamA !== null && set.scoreTeamB !== null)
          .map((set) => [set.id, { scoreA: set.scoreTeamA, scoreB: set.scoreTeamB }]),
      ),
  )

  const [approvalState, setApprovalState] = React.useState<GameApprovalFields>(() => ({
    finishedAt: game.finishedAt ?? null,
    teamAApprovedAt: game.teamAApprovedAt ?? null,
    teamBApprovedAt: game.teamBApprovedAt ?? null,
    adminValidatedAt: game.adminValidatedAt ?? null,
    adminValidatedByName: game.adminValidatedByName ?? null,
  }))
  const [isFinishing, setIsFinishing] = React.useState(false)
  const [approvingTeam, setApprovingTeam] = React.useState<'A' | 'B' | null>(null)
  const [isValidating, setIsValidating] = React.useState(false)
  const [confirmApproveTeam, setConfirmApproveTeam] = React.useState<'A' | 'B' | null>(null)
  const [confirmValidate, setConfirmValidate] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const isAdmin = principal?.type === 'admin'
  const isRefereeTeam = principal?.type === 'team' && principal.name === game.reffingTeam?.name
  const isTeamA = principal?.type === 'team' && principal.name === game.teamA.name
  const isTeamB = principal?.type === 'team' && principal.name === game.teamB.name
  const isFinished = Boolean(approvalState.finishedAt)
  const canEditScores = isAdmin || (isRefereeTeam && !isFinished)

  const updateSetScore = (setId: number, side: 'A' | 'B', value: string) => {
    if (!canEditScores) return
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
    const setDate = set?.startTime ?? set?.endTime ?? null
    const isToday = sameDay(setDate, now)
    const lastUpdatedMs = lastUpdatedBySetId[set.id] ?? null
    const isInCooldown = calculateIsInCooldown(lastUpdatedMs, nowMs)
    return {
      set,
      isToday,
      isInCooldown,
      scores: scoresBySetId[set.id] ?? { scoreA: 0, scoreB: 0 },
    }
  })

  const winnerOfScores = (scores: { scoreA: number; scoreB: number }): 'A' | 'B' | null => {
    if (scores.scoreA > scores.scoreB) return 'A'
    if (scores.scoreB > scores.scoreA) return 'B'
    return null
  }

  // Sets 1 & 2 are always shown. The 3rd/decider set only appears once the
  // first two are split 1-1, or if it already has a recorded score.
  const set1State = setStates[0]
  const set2State = setStates[1]
  const set3State = setStates[2]
  const winner1 = set1State ? winnerOfScores(set1State.scores) : null
  const winner2 = set2State ? winnerOfScores(set2State.scores) : null
  const seriesIsSplit = winner1 !== null && winner2 !== null && winner1 !== winner2
  const thirdSetAlreadyPlayed = Boolean(
    set3State && set3State.set.scoreTeamA !== null && set3State.set.scoreTeamB !== null,
  )
  const showThirdSet = Boolean(set3State) && (seriesIsSplit || thirdSetAlreadyPlayed)

  const activeSetStates = setStates.filter((_, index) => index < 2 || showThirdSet)

  const hasAnyCooldown = activeSetStates.some((state) => state.isInCooldown)
  const allSetsEnded = activeSetStates.every((state) => state.isToday)
  const allActiveSetsSaved = activeSetStates.every((state) => {
    const saved = savedScoresBySetId[state.set.id]
    return saved !== undefined && saved.scoreA === state.scores.scoreA && saved.scoreB === state.scores.scoreB
  })
  const isSavingThisGame = submittingGameId === game.id

  const activeSetWinners = activeSetStates.map((state) => winnerOfScores(state.scores))
  const teamASetWins = activeSetWinners.filter((winner) => winner === 'A').length
  const teamBSetWins = activeSetWinners.filter((winner) => winner === 'B').length
  const matchDecided = teamASetWins >= 2 || teamBSetWins >= 2

  const currentTotalA = activeSetStates.reduce((sum, state) => sum + state.scores.scoreA, 0)
  const currentTotalB = activeSetStates.reduce((sum, state) => sum + state.scores.scoreB, 0)
  const currentWinner: SetWinner = currentTotalA > currentTotalB ? 'A' : currentTotalB > currentTotalA ? 'B' : 'DRAW'

  React.useEffect(() => {
    if (!hasAnyCooldown) return
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 10000)
    return () => window.clearInterval(interval)
  }, [hasAnyCooldown])

  const handleSaveScores = async () => {
    if (!canEditScores || isSavingThisGame) return
    if (!isAdmin && !allSetsEnded) return

    if (isFinished && isAdmin) {
      const confirmed = window.confirm(
        'This game has already been finished. Saving a new score will reset both team approvals and the admin validation. Continue?',
      )
      if (!confirmed) return
    }

    setActionError(null)
    onSubmitGameId(game.id)
    try {
      for (const state of activeSetStates) {
        await submitScore({
          data: {
            gameId: game.id,
            gameSetId: state.set.id,
            scoreTeamA: state.scores.scoreA,
            scoreTeamB: state.scores.scoreB,
          },
        })
      }

      const updatedAt = Date.now()
      setLastUpdatedBySetId((previous) => {
        const next = { ...previous }
        for (const state of activeSetStates) {
          next[state.set.id] = updatedAt
        }
        return next
      })

      const winnerBySet: Record<number, SetWinner> = {}
      for (const state of activeSetStates) {
        if (state.scores.scoreA > state.scores.scoreB) {
          winnerBySet[state.set.id] = 'A'
        } else if (state.scores.scoreB > state.scores.scoreA) {
          winnerBySet[state.set.id] = 'B'
        } else {
          winnerBySet[state.set.id] = 'DRAW'
        }
      }
      setSavedWinnerBySetId((previous) => ({ ...previous, ...winnerBySet }))

      setSavedScoresBySetId((previous) => {
        const next = { ...previous }
        for (const state of activeSetStates) {
          next[state.set.id] = { scoreA: state.scores.scoreA, scoreB: state.scores.scoreB }
        }
        return next
      })

      if (isFinished) {
        setApprovalState({
          finishedAt: null,
          teamAApprovedAt: null,
          teamBApprovedAt: null,
          adminValidatedAt: null,
          adminValidatedByName: null,
        })
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save the score.')
    } finally {
      onSubmitGameId(null)
    }
  }

  const handleFinishGame = async () => {
    if (!canEditScores || isSavingThisGame || isFinishing) return

    setActionError(null)
    setIsFinishing(true)
    try {
      const updated = await finishGameServerFn({ data: { gameId: game.id } })
      setApprovalState(updated)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not finish the game.')
    } finally {
      setIsFinishing(false)
    }
  }

  const handleApproveConfirmed = async (team: 'A' | 'B') => {
    setActionError(null)
    setApprovingTeam(team)
    try {
      const updated = await approveGameServerFn({ data: { gameId: game.id, team } })
      setApprovalState(updated)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not approve the result.')
    } finally {
      setApprovingTeam(null)
      setConfirmApproveTeam(null)
    }
  }

  const handleValidateConfirmed = async () => {
    setActionError(null)
    setIsValidating(true)
    try {
      const updated = await validateGameServerFn({ data: { gameId: game.id } })
      setApprovalState(updated)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not validate the result.')
    } finally {
      setIsValidating(false)
      setConfirmValidate(false)
    }
  }

  const primaryButtonMode: 'save' | 'finish' =
    !isFinished && matchDecided && allActiveSetsSaved ? 'finish' : 'save'

  // Cooldown only matters while there's nothing new to save - it should
  // never block saving a genuinely dirty set just because a *different*
  // set was recently saved.
  const cooldownBlocksSave = hasAnyCooldown && allActiveSetsSaved

  const saveButtonLabel =
    primaryButtonMode === 'finish'
      ? isFinishing
        ? 'Finishing...'
        : 'Finish Game'
      : isFinished
        ? isSavingThisGame
          ? 'Saving...'
          : 'Save Changes'
        : !allSetsEnded && !isAdmin
          ? 'Please Wait'
          : cooldownBlocksSave
              ? 'Updated Successfully'
              : isSavingThisGame
                ? 'Saving...'
                : 'Save'

  const refereeTimeGateBlocked = !isAdmin && !allSetsEnded
  const saveButtonDisabled =
    !canEditScores ||
    isSavingThisGame ||
    isFinishing ||
    (primaryButtonMode === 'save' && !isFinished && (cooldownBlocksSave || refereeTimeGateBlocked))

  const handlePrimaryButtonClick = () => {
    if (primaryButtonMode === 'finish') {
      void handleFinishGame()
    } else {
      void handleSaveScores()
    }
  }

  return (
    <article className="card shadow-sm" key={game.id}>
      <div className="card-body d-flex flex-column flex-md-row gap-3 align-items-stretch">
        <aside
          className="d-flex flex-row flex-md-column text-center flex-shrink-0 division-schedule-game-time-column"
        >
          <div className={`division-schedule-time-slot`}>
            <div className="small text-body-secondary text-uppercase division-schedule-time-label">Match</div>
            <div className="fw-semibold division-schedule-time-value">{matchNumber}</div>
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
                {activeSetStates.map(({ set, isToday, scores }, setIndex) => {
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
                      disabled={!isAdmin && (!isToday || !canEditScores)}
                      onFocus={(e) => e.target.select()}
                    />
                </React.Fragment>
              })}
              {isFinished && (
                <ApprovalControl
                label={game.teamA.name}
                approvedAt={approvalState.teamAApprovedAt}
                canApprove={isTeamA}
                isSubmitting={approvingTeam === 'A'}
                onRequestApprove={() => setConfirmApproveTeam('A')}
              />)}
              </div>
            <div className="d-flex align-items-center fw-semibold text-body-secondary px-1">vs</div>
            <div
              className={`badge text-center py-2 d-flex flex-column h-100 division-schedule-team-badge ${teamBPaletteClass}`}
            >
              <div className="flex-grow-1 d-flex align-items-center justify-content-center">{game.teamB.name}</div>
               {activeSetStates.map(({ set, isToday, scores }, setIndex) => {
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
                      disabled={!isAdmin && (!isToday || !canEditScores)}
                      onFocus={(e) => e.target.select()}
                    />
                </React.Fragment>
              })}
              
              {isFinished && (
                <ApprovalControl
                label={game.teamB.name}
                approvedAt={approvalState.teamBApprovedAt}
                canApprove={isTeamB}
                isSubmitting={approvingTeam === 'B'}
                onRequestApprove={() => setConfirmApproveTeam('B')}
              />)}
            </div>
          </div>

          {canEditScores && (
            <div className="d-flex no-print">
              <button
                type="button"
                className="btn btn-sm btn-banana w-100 text-center"
                onClick={handlePrimaryButtonClick}
                disabled={saveButtonDisabled}
              >
                {saveButtonLabel}
              </button>
            </div>
          )}

          {isFinished && (
            <div className="d-flex flex-column gap-2 no-print division-schedule-approval-row">
              <ValidateControl
                validatedAt={approvalState.adminValidatedAt}
                validatedByName={approvalState.adminValidatedByName}
                canValidate={isAdmin}
                isSubmitting={isValidating}
                onRequestValidate={() => setConfirmValidate(true)}
              />
            </div>
          )}

          {actionError && <p className="text-danger small mb-0 no-print">{actionError}</p>}

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

      <Modal show={confirmApproveTeam !== null} onHide={() => setConfirmApproveTeam(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">Confirm Result</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Final score: <strong>{game.teamA.name} {currentTotalA} - {currentTotalB} {game.teamB.name}</strong>
          </p>
          <p className="mb-0">
            {currentWinner === 'DRAW'
              ? 'This match is a draw.'
              : (
                <>Winning team: <strong>{currentWinner === 'A' ? game.teamA.name : game.teamB.name}</strong></>
              )}
          </p>
          <p className="text-body-secondary small mt-2 mb-0">
            Approving as {confirmApproveTeam === 'A' ? game.teamA.name : game.teamB.name}. This cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmApproveTeam(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-banana"
            disabled={approvingTeam !== null}
            onClick={() => confirmApproveTeam && handleApproveConfirmed(confirmApproveTeam)}
          >
            Confirm Approval
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={confirmValidate} onHide={() => setConfirmValidate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">Validate Result</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            Final score: <strong>{game.teamA.name} {currentTotalA} - {currentTotalB} {game.teamB.name}</strong>
          </p>
          <p className="text-body-secondary small mt-2 mb-0">
            This confirms an admin has checked and validated this result.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmValidate(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-banana" disabled={isValidating} onClick={handleValidateConfirmed}>
            Confirm Validation
          </button>
        </Modal.Footer>
      </Modal>
    </article>
  )
}

function ApprovalControl({
  label,
  approvedAt,
  canApprove,
  isSubmitting,
  onRequestApprove,
}: {
  label: string
  approvedAt: Date | null
  canApprove: boolean
  isSubmitting: boolean
  onRequestApprove: () => void
}) {
  if (approvedAt) {
    return (
      <span className="badge text-bg-success-subtle text-success d-inline-flex align-items-center gap-1 py-2">
        <CheckCircleFill /> {label} Accepted
      </span>
    )
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      disabled={!canApprove || isSubmitting}
      title={canApprove ? undefined : `Only ${label}, logged in as that team, can approve`}
      onClick={onRequestApprove}
    >
      {isSubmitting ? 'Approving...' : `Approve as ${label}`}
    </button>
  )
}

function ValidateControl({
  validatedAt,
  validatedByName,
  canValidate,
  isSubmitting,
  onRequestValidate,
}: {
  validatedAt: Date | null
  validatedByName: string | null
  canValidate: boolean
  isSubmitting: boolean
  onRequestValidate: () => void
}) {
  if (validatedAt) {
    return (
      <span className="badge text-bg-info-subtle text-info-emphasis d-flex w-100 justify-content-center align-items-center gap-1 py-2">
        <ShieldCheck /> Validated by {validatedByName ?? 'admin'}
      </span>
    )
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-center align-items-center gap-1"
      disabled={!canValidate || isSubmitting}
      title={canValidate ? undefined : 'Only an admin can validate this result'}
      onClick={onRequestValidate}
    >
      <ShieldExclamation />
      {isSubmitting ? 'Validating...' : 'Admin Validate'}
    </button>
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
          {data.division.games.map((game, index) => (
            <GameCard
              key={game.id}
              game={game}
              matchNumber={index + 1}
              principal={data.principal}
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
