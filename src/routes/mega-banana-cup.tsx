import * as fs from 'fs'
import path from 'path'
import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

type TeamName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

type MatchSlot = {
  id: string
  start: string
  end: string
  court1: {
    pool: string
    playing: [TeamName, TeamName]
    reffing: TeamName
  }
  court2: {
    pool: string
    playing: [TeamName, TeamName]
    reffing: TeamName
  }
}

type PoolName = 'Pool 1' | 'Pool 2'

type ScoreEntry = {
  team1: string
  team2: string
}

type StandingRow = {
  team: TeamName
  pf: number
  pa: number
  coefficient: number
  wins: number
  losses: number
}

type GeneratedSecondPhase = {
  upper: TeamName[]
  lower: TeamName[]
}

type SecondPhasePoolName = 'Upper Pool' | 'Lower Pool'

type MegaBananaCupState = {
  phase1Scores: Record<string, ScoreEntry>
  secondPhase: GeneratedSecondPhase | null
  phase2Scores: Record<string, ScoreEntry>
}

const EDIT_PASSWORD = 'bananaForever'

const DEFAULT_CUP_STATE: MegaBananaCupState = {
  phase1Scores: {},
  secondPhase: null,
  phase2Scores: {},
}

const POOL_TEAMS: Record<PoolName, TeamName[]> = {
  'Pool 1': ['A', 'B', 'C'],
  'Pool 2': ['D', 'E', 'F'],
}

const SECOND_PHASE_TIMES = [
  { id: 's2r1', start: '13:45', end: '14:07' },
  { id: 's2r2', start: '14:09', end: '14:31' },
  { id: 's2r3', start: '14:33', end: '14:55' },
] as const

const matchSlots: MatchSlot[] = [
  {
    id: 'r1',
    start: '12:15',
    end: '12:43',
    court1: {
      pool: 'Pool 1',
      playing: ['A', 'B'],
      reffing: 'C',
    },
    court2: {
      pool: 'Pool 2',
      playing: ['D', 'E'],
      reffing: 'F',
    },
  },
  {
    id: 'r2',
    start: '12:45',
    end: '13:13',
    court1: {
      pool: 'Pool 1',
      playing: ['A', 'C'],
      reffing: 'B',
    },
    court2: {
      pool: 'Pool 2',
      playing: ['D', 'F'],
      reffing: 'E',
    },
  },
  {
    id: 'r3',
    start: '13:15',
    end: '13:43',
    court1: {
      pool: 'Pool 1',
      playing: ['B', 'C'],
      reffing: 'A',
    },
    court2: {
      pool: 'Pool 2',
      playing: ['E', 'F'],
      reffing: 'D',
    },
  },
]

const timeline = [
  {
    label: 'Warmup',
    start: '12:00',
    end: '12:15',
    detail: 'All teams warm up on both courts.',
    kind: 'warmup',
  },
  {
    label: 'Round 1',
    start: '12:15',
    end: '12:43',
    detail: 'Pool round robin starts.',
    kind: 'match',
  },
  {
    label: 'Transition',
    start: '12:43',
    end: '12:45',
    detail: '2 minute changeover.',
    kind: 'transition',
  },
  {
    label: 'Round 2',
    start: '12:45',
    end: '13:13',
    detail: 'Second round in both pools.',
    kind: 'match',
  },
  {
    label: 'Transition',
    start: '13:13',
    end: '13:15',
    detail: '2 minute changeover.',
    kind: 'transition',
  },
  {
    label: 'Round 3',
    start: '13:15',
    end: '13:43',
    detail: 'Final pool round in both pools.',
    kind: 'match',
  },
  {
    label: 'Buffer',
    start: '13:43',
    end: '13:45',
    detail: 'Transition and score check before phase 2.',
    kind: 'buffer',
  },
] as const

const loadMegaBananaCupState = createServerFn({ method: 'GET' }).handler(async () => {
  const filePath = path.resolve(process.cwd(), 'data/megabananacup.json')

  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<MegaBananaCupState>

    return {
      phase1Scores: parsed.phase1Scores ?? {},
      secondPhase: parsed.secondPhase ?? null,
      phase2Scores: parsed.phase2Scores ?? {},
    } satisfies MegaBananaCupState
  } catch {
    return null
  }
})

const saveMegaBananaCupState = createServerFn({ method: 'POST' })
  .inputValidator((state: MegaBananaCupState) => state)
  .handler(async ({ data }) => {
    const filePath = path.resolve(process.cwd(), 'data/megabananacup.json')
    await fs.promises.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')

    return {
      filePath,
    }
  })

function computePoolStandings(
  poolTeams: TeamName[],
  matches: Array<{
    matchKey: string
    playing: [TeamName, TeamName]
  }>,
  scores: Record<string, ScoreEntry>,
) {
  const rowsMap = new Map<TeamName, StandingRow>(
    poolTeams.map((team) => [
      team,
      {
        team,
        pf: 0,
        pa: 0,
        coefficient: 0,
        wins: 0,
        losses: 0,
      },
    ]),
  )

  const headToHead = new Map<TeamName, Map<TeamName, number>>()
  for (const team of poolTeams) {
    headToHead.set(team, new Map(poolTeams.map((rival) => [rival, 0])))
  }

  for (const match of matches) {
    const score = scores[match.matchKey]
    if (!score || score.team1 === '' || score.team2 === '') {
      continue
    }

    const team1Score = Number(score.team1)
    const team2Score = Number(score.team2)
    if (Number.isNaN(team1Score) || Number.isNaN(team2Score)) {
      continue
    }

    const team1Row = rowsMap.get(match.playing[0])
    const team2Row = rowsMap.get(match.playing[1])
    if (!team1Row || !team2Row) {
      continue
    }

    team1Row.pf += team1Score
    team1Row.pa += team2Score
    team2Row.pf += team2Score
    team2Row.pa += team1Score

    if (team1Score > team2Score) {
      team1Row.wins += 1
      team2Row.losses += 1
    } else if (team2Score > team1Score) {
      team2Row.wins += 1
      team1Row.losses += 1
    }

    headToHead.get(match.playing[0])?.set(match.playing[1], team1Score - team2Score)
    headToHead.get(match.playing[1])?.set(match.playing[0], team2Score - team1Score)
  }

  return Array.from(rowsMap.values())
    .map((row) => ({
      ...row,
      coefficient:
        row.pa === 0
          ? row.pf > 0
            ? Number.POSITIVE_INFINITY
            : 0
          : row.pf / row.pa,
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins
      }
      if (b.coefficient !== a.coefficient) {
        return b.coefficient - a.coefficient
      }
      if (b.pf !== a.pf) {
        return b.pf - a.pf
      }
      const headToHeadDiff = headToHead.get(a.team)?.get(b.team) ?? 0
      if (headToHeadDiff !== 0) {
        return headToHeadDiff > 0 ? -1 : 1
      }
      if (a.pa !== b.pa) {
        return a.pa - b.pa
      }
      return a.team.localeCompare(b.team)
    })
}

function buildThreeTeamRoundRobin(
  poolName: SecondPhasePoolName,
  teams: TeamName[],
): CourtSlot[] {
  if (teams.length < 3) {
    return []
  }

  const [teamA, teamB, teamC] = teams

  return [
    {
      id: SECOND_PHASE_TIMES[0].id,
      start: SECOND_PHASE_TIMES[0].start,
      end: SECOND_PHASE_TIMES[0].end,
      pool: poolName,
      playing: [teamA, teamB],
      reffing: teamC,
    },
    {
      id: SECOND_PHASE_TIMES[1].id,
      start: SECOND_PHASE_TIMES[1].start,
      end: SECOND_PHASE_TIMES[1].end,
      pool: poolName,
      playing: [teamA, teamC],
      reffing: teamB,
    },
    {
      id: SECOND_PHASE_TIMES[2].id,
      start: SECOND_PHASE_TIMES[2].start,
      end: SECOND_PHASE_TIMES[2].end,
      pool: poolName,
      playing: [teamB, teamC],
      reffing: teamA,
    },
  ]
}

function TeamBadge({
  team,
  subtle = false,
}: {
  team: TeamName
  subtle?: boolean
}) {
  return (
    <span
      className={`badge team-badge team-${team.toLowerCase()} ${subtle ? 'team-badge-subtle' : 'team-badge-strong'}`}
    >
      Team {team}
    </span>
  )
}

export const Route = createFileRoute('/mega-banana-cup')({
  loader: async () => await loadMegaBananaCupState(),
  component: MegaBananaCup,
})

function MegaBananaCup() {
  const initialCupState = Route.useLoaderData() ?? DEFAULT_CUP_STATE
  const court1Slots = useMemo(
    () =>
      matchSlots.map((slot) => ({
        id: slot.id,
        start: slot.start,
        end: slot.end,
        pool: slot.court1.pool as PoolName,
        playing: slot.court1.playing,
        reffing: slot.court1.reffing,
      })),
    [],
  )

  const court2Slots = useMemo(
    () =>
      matchSlots.map((slot) => ({
        id: slot.id,
        start: slot.start,
        end: slot.end,
        pool: slot.court2.pool as PoolName,
        playing: slot.court2.playing,
        reffing: slot.court2.reffing,
      })),
    [],
  )

  const [scores, setScores] = useState<Record<string, ScoreEntry>>(initialCupState.phase1Scores)
  const [secondPhase, setSecondPhase] = useState<GeneratedSecondPhase | null>(initialCupState.secondPhase)
  const [secondPhaseScores, setSecondPhaseScores] = useState<Record<string, ScoreEntry>>(initialCupState.phase2Scores)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState('')
  const [saveError, setSaveError] = useState('')

  const handleScoreChange = (
    matchKey: string,
    team: 'team1' | 'team2',
    value: string,
  ) => {
    if (!isEditMode) {
      return
    }

    const safeValue = value === '' ? '' : String(Math.max(0, Number(value) || 0))

    setScores((current) => ({
      ...current,
      [matchKey]: {
        team1: current[matchKey]?.team1 ?? '',
        team2: current[matchKey]?.team2 ?? '',
        [team]: safeValue,
      },
    }))
  }

  const standingsByPool = useMemo(() => {
    return {
      'Pool 1': computePoolStandings(
        POOL_TEAMS['Pool 1'],
        court1Slots.map((slot) => ({
          matchKey: `court1-${slot.id}`,
          playing: slot.playing,
        })),
        scores,
      ),
      'Pool 2': computePoolStandings(
        POOL_TEAMS['Pool 2'],
        court2Slots.map((slot) => ({
          matchKey: `court2-${slot.id}`,
          playing: slot.playing,
        })),
        scores,
      ),
    }
  }, [court1Slots, court2Slots, scores])

  const formatCoefficient = (value: number) => {
    if (!Number.isFinite(value)) {
      return 'INF'
    }

    return value.toFixed(3)
  }

  const allMatchKeys = useMemo(
    () => [
      ...court1Slots.map((slot) => `court1-${slot.id}`),
      ...court2Slots.map((slot) => `court2-${slot.id}`),
    ],
    [court1Slots, court2Slots],
  )

  const completedMatches = useMemo(
    () =>
      allMatchKeys.filter((matchKey) => {
        const score = scores[matchKey]
        return score !== undefined && score.team1 !== '' && score.team2 !== ''
      }).length,
    [allMatchKeys, scores],
  )

  const generateSecondPhase = () => {
    if (!isEditMode) {
      return
    }

    const rankedTeams = (Object.keys(POOL_TEAMS) as PoolName[])
      .flatMap((poolName) => standingsByPool[poolName])
      .sort((a, b) => {
        if (b.wins !== a.wins) {
          return b.wins - a.wins
        }
        if (b.coefficient !== a.coefficient) {
          return b.coefficient - a.coefficient
        }
        if (b.pf !== a.pf) {
          return b.pf - a.pf
        }
        if (a.pa !== b.pa) {
          return a.pa - b.pa
        }
        return a.team.localeCompare(b.team)
      })

    setSecondPhase({
      upper: rankedTeams.slice(0, 3).map((row) => row.team),
      lower: rankedTeams.slice(3).map((row) => row.team),
    })
    setSecondPhaseScores({})
  }

  const secondPhaseCourt1Slots = useMemo(() => {
    if (!secondPhase || secondPhase.upper.length < 3) {
      return [] as CourtSlot[]
    }

    return buildThreeTeamRoundRobin('Upper Pool', secondPhase.upper)
  }, [secondPhase])

  const secondPhaseCourt2Slots = useMemo(() => {
    if (!secondPhase || secondPhase.lower.length < 3) {
      return [] as CourtSlot[]
    }

    return buildThreeTeamRoundRobin('Lower Pool', secondPhase.lower)
  }, [secondPhase])

  const secondPhaseStandings = useMemo(() => {
    if (!secondPhase) {
      return null
    }

    return {
      'Upper Pool': computePoolStandings(
        secondPhase.upper,
        secondPhaseCourt1Slots.map((slot) => ({
          matchKey: `phase2-court1-${slot.id}`,
          playing: slot.playing,
        })),
        secondPhaseScores,
      ),
      'Lower Pool': computePoolStandings(
        secondPhase.lower,
        secondPhaseCourt2Slots.map((slot) => ({
          matchKey: `phase2-court2-${slot.id}`,
          playing: slot.playing,
        })),
        secondPhaseScores,
      ),
    } as Record<SecondPhasePoolName, StandingRow[]>
  }, [secondPhase, secondPhaseCourt1Slots, secondPhaseCourt2Slots, secondPhaseScores])

  const phase2MatchKeys = useMemo(
    () => [
      ...secondPhaseCourt1Slots.map((slot) => `phase2-court1-${slot.id}`),
      ...secondPhaseCourt2Slots.map((slot) => `phase2-court2-${slot.id}`),
    ],
    [secondPhaseCourt1Slots, secondPhaseCourt2Slots],
  )

  const completedPhase2Matches = useMemo(
    () =>
      phase2MatchKeys.filter((matchKey) => {
        const score = secondPhaseScores[matchKey]
        return score !== undefined && score.team1 !== '' && score.team2 !== ''
      }).length,
    [phase2MatchKeys, secondPhaseScores],
  )

  const handleSecondPhaseScoreChange = (
    matchKey: string,
    team: 'team1' | 'team2',
    value: string,
  ) => {
    if (!isEditMode) {
      return
    }

    const safeValue = value === '' ? '' : String(Math.max(0, Number(value) || 0))

    setSecondPhaseScores((current) => ({
      ...current,
      [matchKey]: {
        team1: current[matchKey]?.team1 ?? '',
        team2: current[matchKey]?.team2 ?? '',
        [team]: safeValue,
      },
    }))
  }

  const handleEnableEditing = () => {
    if (isEditMode) {
      setIsEditMode(false)
      setSaveFeedback('Editing locked.')
      setSaveError('')
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const password = window.prompt('Enter password to enable editing')

    if (password === EDIT_PASSWORD) {
      setIsEditMode(true)
      setSaveFeedback('Editing enabled.')
      setSaveError('')
      return
    }

    setSaveError('Incorrect password. Editing remains locked.')
    setSaveFeedback('')
  }

  const handleSaveCup = async () => {
    setIsSaving(true)
    setSaveFeedback('')
    setSaveError('')

    try {
      await saveMegaBananaCupState({
        data: {
          phase1Scores: scores,
          secondPhase,
          phase2Scores: secondPhaseScores,
        },
      })

      setSaveFeedback('Saved Mega Banana Cup state to data/megabananacup.json.')
    } catch {
      setSaveError('Could not save megabananacup.json. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetCup = () => {
    if (!isEditMode) {
      return
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Reset all Mega Banana Cup scores and generated phase 2 data?',
      )

      if (!confirmed) {
        return
      }
    }

    setScores(DEFAULT_CUP_STATE.phase1Scores)
    setSecondPhase(DEFAULT_CUP_STATE.secondPhase)
    setSecondPhaseScores(DEFAULT_CUP_STATE.phase2Scores)
    setSaveFeedback('Cup state reset in memory. Save to persist the reset.')
    setSaveError('')
  }

  return (
    <section className="mega-banana-cup-page">
      <div className="d-flex flex-column gap-3 mb-4">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3">
          <div>
            <h1 className="h2 mb-1">Mega Banana Cup</h1>
            <p className="mb-0 text-body-secondary">
              Saturday 28 March 2026, 12:00 to 15:00. Phase 1 runs until 13:45 with
              2 pools and 2 courts.
            </p>
          </div>

          <div className="d-flex flex-column align-items-stretch gap-2 cup-admin-controls">
            <button
              type="button"
              className={`btn ${isEditMode ? 'btn-outline-secondary' : 'btn-banana'}`}
              onClick={handleEnableEditing}
            >
              {isEditMode ? 'Lock Editing' : 'Enable Editing'}
            </button>

            {isEditMode && (
              <>
                <button
                  type="button"
                  className="btn btn-banana"
                  onClick={handleSaveCup}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Cup'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={handleResetCup}
                  disabled={isSaving}
                >
                  Reset Cup
                </button>
              </>
            )}
          </div>
        </div>

        {saveFeedback !== '' && (
          <div className="alert alert-banana mb-0" role="status">
            {saveFeedback}
          </div>
        )}

        {saveError !== '' && (
          <div className="alert alert-danger mb-0" role="alert">
            {saveError}
          </div>
        )}

        <div className="row g-2 g-md-3">
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 mb-2">Pool 1</h2>
                <div className="d-flex flex-wrap gap-2">
                  <TeamBadge team="A" subtle />
                  <TeamBadge team="B" subtle />
                  <TeamBadge team="C" subtle />
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 mb-2">Pool 2</h2>
                <div className="d-flex flex-wrap gap-2">
                  <TeamBadge team="D" subtle />
                  <TeamBadge team="E" subtle />
                  <TeamBadge team="F" subtle />
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 mb-2">Courts</h2>
                <p className="mb-0">Court 1 and Court 2 in parallel.</p>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 mb-2">Format</h2>
                <p className="mb-0">Games to max points, with 2 minute transitions.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 g-xl-4">
        <div className="col-12 col-xl-3">
          <div className="d-flex flex-column gap-3">
            <aside className="card shadow-sm border-0 cup-court-card">
              <div className="card-header border-0 bg-transparent pt-3 pb-1">
                <h2 className="h5 mb-0">Standings</h2>
              </div>
              <div className="card-body pt-2 d-flex flex-column gap-3">
                <div className="alert alert-banana mb-0 py-2 px-3 cup-rules-alert">
                  <p className="small mb-1 fw-semibold">Tie-break order:</p>
                  <p className="small mb-0">1) Wins, 2) PF/PA coefficient, 3) PF, 4) head-to-head.</p>
                </div>

                {(Object.keys(POOL_TEAMS) as PoolName[]).map((poolName) => (
                  <div key={poolName}>
                    <h3 className="h6 mb-2">{poolName}</h3>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0 cup-standings-table">
                        <thead>
                          <tr>
                            <th scope="col" className="text-end">#</th>
                            <th scope="col">Team</th>
                            <th scope="col" className="text-end">W</th>
                            <th scope="col" className="text-end">L</th>
                            <th scope="col" className="text-end">PF</th>
                            <th scope="col" className="text-end">PA</th>
                            <th scope="col" className="text-end">PF/PA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standingsByPool[poolName].map((row, index) => (
                            <tr key={`${poolName}-${row.team}`} className={index === 0 ? 'cup-row-winner' : ''}>
                              <td className="text-end fw-semibold">{index + 1}</td>
                              <td>
                                <TeamBadge team={row.team} subtle={index !== 0} />
                              </td>
                              <td className="text-end fw-semibold">{row.wins}</td>
                              <td className="text-end fw-semibold">{row.losses}</td>
                              <td className="text-end fw-semibold">{row.pf}</td>
                              <td className="text-end fw-semibold">{row.pa}</td>
                              <td className="text-end fw-semibold">
                                {formatCoefficient(row.coefficient)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <aside className="card shadow-sm border-0 cup-timeline-card">
              <div className="card-header border-0 bg-transparent pt-3 pb-1">
                <h2 className="h5 mb-0">Timeline</h2>
              </div>
              <div className="card-body pt-2">
                <ol className="list-unstyled d-flex flex-column gap-2 mb-0">
                  {timeline.map((slot) => (
                    <li key={`${slot.start}-${slot.label}`} className="cup-timeline-item">
                      <div className={`cup-timeline-pill cup-${slot.kind}`}>
                        <div className="small fw-semibold">{slot.label}</div>
                        <div className="small">{slot.start} - {slot.end}</div>
                      </div>
                      <p className="small mb-0 mt-1 text-body-secondary">{slot.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>

            <aside className="card shadow-sm border-0 cup-court-card">
              <div className="card-header border-0 bg-transparent pt-3 pb-1">
                <h2 className="h5 mb-0">Phase 2 Generator</h2>
              </div>
              <div className="card-body pt-2 d-flex flex-column gap-3">
                <p className="small text-body-secondary mb-0">
                  Based on current standings: {completedMatches}/{allMatchKeys.length} matches entered.
                </p>

                <button
                  type="button"
                  className="btn btn-banana"
                  onClick={generateSecondPhase}
                  disabled={!isEditMode}
                >
                  Generate Upper/Lower Pools
                </button>

                {secondPhase && (
                  <div className="d-flex flex-column gap-2">
                    <div className="cup-phase-pool-block">
                      <p className="small text-uppercase fw-semibold text-body-secondary mb-1">Upper Pool</p>
                      <div className="d-flex flex-wrap gap-2">
                        {secondPhase.upper.map((team) => (
                          <TeamBadge key={`upper-${team}`} team={team} />
                        ))}
                      </div>
                    </div>

                    <div className="cup-phase-pool-block">
                      <p className="small text-uppercase fw-semibold text-body-secondary mb-1">Lower Pool</p>
                      <div className="d-flex flex-wrap gap-2">
                        {secondPhase.lower.map((team) => (
                          <TeamBadge key={`lower-${team}`} team={team} subtle />
                        ))}
                      </div>
                    </div>

                    <p className="small text-body-secondary mb-0">
                      Phase 2 runs 13:45 to 14:55 with 3 rounds and 2 minute transitions.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>

        <div className="col-12 col-xl-9">
          <div className="row g-3 g-xl-4">
            <div className="col-12 col-lg-6">
              <CourtSchedule
                title="Court 1"
                courtKey="court1"
                slots={court1Slots}
                scores={scores}
                isEditable={isEditMode}
                onScoreChange={handleScoreChange}
              />
            </div>

            <div className="col-12 col-lg-6">
              <CourtSchedule
                title="Court 2"
                courtKey="court2"
                slots={court2Slots}
                scores={scores}
                isEditable={isEditMode}
                onScoreChange={handleScoreChange}
              />
            </div>
          </div>

          {secondPhase && (
            <div className="mt-4 d-flex flex-column gap-3">
              <section className="card shadow-sm border-0 cup-court-card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h2 className="h5 mb-0">Phase 2: Upper and Lower Pools</h2>
                  <span className="badge badge-banana">
                    {completedPhase2Matches}/{phase2MatchKeys.length} matches scored
                  </span>
                </div>
                <div className="card-body">
                  <div className="row g-3 g-xl-4">
                    <div className="col-12 col-lg-6">
                      <CourtSchedule
                        title="Court 1"
                        courtKey="phase2-court1"
                        slots={secondPhaseCourt1Slots}
                        scores={secondPhaseScores}
                        isEditable={isEditMode}
                        onScoreChange={handleSecondPhaseScoreChange}
                      />
                    </div>

                    <div className="col-12 col-lg-6">
                      <CourtSchedule
                        title="Court 2"
                        courtKey="phase2-court2"
                        slots={secondPhaseCourt2Slots}
                        scores={secondPhaseScores}
                        isEditable={isEditMode}
                        onScoreChange={handleSecondPhaseScoreChange}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {secondPhaseStandings && (
                <section className="card shadow-sm border-0 cup-court-card">
                  <div className="card-header border-0 bg-transparent pt-3 pb-1">
                    <h2 className="h5 mb-0">Phase 2 Standings</h2>
                  </div>
                  <div className="card-body pt-2">
                    <div className="row g-3">
                      {(['Upper Pool', 'Lower Pool'] as const).map((poolName) => (
                        <div key={poolName} className="col-12 col-lg-6">
                          <h3 className="h6 mb-2">{poolName}</h3>
                          <div className="table-responsive">
                            <table className="table table-sm align-middle mb-0 cup-standings-table">
                              <thead>
                                <tr>
                                  <th scope="col" className="text-end">#</th>
                                  <th scope="col">Team</th>
                                  <th scope="col" className="text-end">W</th>
                                  <th scope="col" className="text-end">L</th>
                                  <th scope="col" className="text-end">PF</th>
                                  <th scope="col" className="text-end">PA</th>
                                  <th scope="col" className="text-end">PF/PA</th>
                                </tr>
                              </thead>
                              <tbody>
                                {secondPhaseStandings[poolName].map((row, index) => (
                                  <tr key={`${poolName}-${row.team}`} className={index === 0 ? 'cup-row-winner' : ''}>
                                    <td className="text-end fw-semibold">{index + 1}</td>
                                    <td>
                                      <TeamBadge team={row.team} subtle={index !== 0} />
                                    </td>
                                    <td className="text-end fw-semibold">{row.wins}</td>
                                    <td className="text-end fw-semibold">{row.losses}</td>
                                    <td className="text-end fw-semibold">{row.pf}</td>
                                    <td className="text-end fw-semibold">{row.pa}</td>
                                    <td className="text-end fw-semibold">{formatCoefficient(row.coefficient)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

type CourtSlot = {
  id: string
  start: string
  end: string
  pool: PoolName | SecondPhasePoolName
  playing: [TeamName, TeamName]
  reffing: TeamName
}

function CourtSchedule({
  title,
  courtKey,
  slots,
  scores,
  isEditable,
  onScoreChange,
}: {
  title: string
  courtKey: 'court1' | 'court2' | 'phase2-court1' | 'phase2-court2'
  slots: CourtSlot[]
  scores: Record<string, ScoreEntry>
  isEditable: boolean
  onScoreChange: (matchKey: string, team: 'team1' | 'team2', value: string) => void
}) {
  return (
    <section className="card shadow-sm border-0 h-100 cup-court-card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h2 className="h5 mb-0">{title}</h2>
        <span className="badge badge-banana">{slots.length} rounds</span>
      </div>

      <div className="card-body d-flex flex-column gap-3">
        {slots.map((slot, index) => (
          <div key={`${courtKey}-${slot.id}`} className="cup-match-block">
            <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
              <div>
                <p className="mb-0 small text-uppercase fw-semibold text-body-secondary">
                  {slot.pool}
                </p>
                <h3 className="h6 mb-0">Round {index + 1}</h3>
              </div>
              <span className="badge badge-banana-subtle">
                {slot.start} - {slot.end}
              </span>
            </div>

            <div className="d-flex flex-column gap-2">
              <div className="cup-team-row">
                <span className="small text-body-secondary">Playing</span>
                <div className="d-flex align-items-center gap-2">
                  <TeamBadge team={slot.playing[0]} />
                  <span className="small fw-semibold text-body-secondary">vs</span>
                  <TeamBadge team={slot.playing[1]} />
                </div>
              </div>

              <div className="cup-team-row">
                <span className="small text-body-secondary">Reffing</span>
                <TeamBadge team={slot.reffing} subtle />
              </div>

              <div className="cup-score-grid" role="group" aria-label={`Score entry for ${title} round ${index + 1}`}>
                <div className="cup-score-input-wrap">
                  <label className="small text-body-secondary mb-1" htmlFor={`${courtKey}-${slot.id}-team1`}>
                    Team {slot.playing[0]}
                  </label>
                  <input
                    id={`${courtKey}-${slot.id}-team1`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="form-control form-control-sm cup-score-input"
                    value={scores[`${courtKey}-${slot.id}`]?.team1 ?? ''}
                    disabled={!isEditable}
                    onChange={(event) =>
                      onScoreChange(`${courtKey}-${slot.id}`, 'team1', event.target.value)
                    }
                    placeholder="0"
                  />
                </div>

                <div className="cup-score-input-wrap">
                  <label className="small text-body-secondary mb-1" htmlFor={`${courtKey}-${slot.id}-team2`}>
                    Team {slot.playing[1]}
                  </label>
                  <input
                    id={`${courtKey}-${slot.id}-team2`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="form-control form-control-sm cup-score-input"
                    value={scores[`${courtKey}-${slot.id}`]?.team2 ?? ''}
                    disabled={!isEditable}
                    onChange={(event) =>
                      onScoreChange(`${courtKey}-${slot.id}`, 'team2', event.target.value)
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}