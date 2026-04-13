import * as fs from 'fs'
import path from 'path'
import { useMemo, useState } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import Tab from 'react-bootstrap/Tab'
import Tabs from 'react-bootstrap/Tabs'

type TeamData = {
  team_name: string
  captain: string
}

type DivisionData = {
  division_name: string
  division_short: string
  teams: TeamData[]
}

type Match = {
  id: string
  start: string
  end: string
  teamALabel: 'A' | 'B' | 'C' | 'D'
  teamBLabel: 'A' | 'B' | 'C' | 'D'
  refLabel: 'A' | 'B' | 'C' | 'D'
  teamA: TeamData
  teamB: TeamData
  ref: TeamData
}

type Score = {
  teamA: string
  teamB: string
}

const MATCH_DURATIONS_MINUTES = [33, 33, 33, 32, 32, 32] as const
const INTERMISSION_MINUTES = 3
const MATCH_START_TIME = '18:20'
const TEAM_LABELS = ['A', 'B', 'C', 'D'] as const

const loadSpringLeagueData = createServerFn({ method: 'GET' }).handler(async () => {
  const filePath = path.resolve(process.cwd(), 'data/spring-league.json')
  const raw = await fs.promises.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as DivisionData[]
})

export const Route = createFileRoute('/old/spring-league')({
  loader: async () => await loadSpringLeagueData(),
  component: SpringLeague,
})

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours * 60) + minutes
}

function formatMinutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function buildRoundRobin(teams: TeamData[]) {
  const pairs: Array<[number, number]> = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ]

  let cursorMinutes = parseTimeToMinutes(MATCH_START_TIME)

  return pairs.map(([teamAIndex, teamBIndex], index) => {
    const start = formatMinutesToTime(cursorMinutes)
    const duration = MATCH_DURATIONS_MINUTES[index]
    cursorMinutes += duration
    const end = formatMinutesToTime(cursorMinutes)
    cursorMinutes += INTERMISSION_MINUTES

    const refIndex = teams.findIndex((_, teamIndex) => teamIndex !== teamAIndex && teamIndex !== teamBIndex)
    const safeRefIndex = refIndex === -1 ? 0 : refIndex

    return {
      id: `m${index + 1}`,
      start,
      end,
      teamALabel: TEAM_LABELS[teamAIndex],
      teamBLabel: TEAM_LABELS[teamBIndex],
      refLabel: TEAM_LABELS[safeRefIndex],
      teamA: teams[teamAIndex],
      teamB: teams[teamBIndex],
      ref: teams[safeRefIndex],
    } satisfies Match
  })
}

function TeamBadge({
  teamLabel,
  team,
}: {
  teamLabel: 'A' | 'B' | 'C' | 'D'
  team: TeamData
}) {
  return (
    <span className={`badge team-badge team-${teamLabel.toLowerCase()} team-badge-subtle spring-league-team-pill`}>
      {teamLabel}: {team.team_name}
    </span>
  )
}

function SpringLeague() {
  const divisions = Route.useLoaderData() ?? []
  const [activeTab, setActiveTab] = useState(divisions[0]?.division_short ?? 'Div 1')
  const [scores, setScores] = useState<Record<string, Score>>({})

  const divisionSchedules = useMemo(
    () =>
      divisions.map((division) => ({
        ...division,
        matches: buildRoundRobin(division.teams.slice(0, 4)),
      })),
    [divisions],
  )

  const handleScoreChange = (
    divisionShort: string,
    matchId: string,
    key: keyof Score,
    value: string,
  ) => {
    const safeValue = value === '' ? '' : String(Math.max(0, Number(value) || 0))
    const scoreKey = `${divisionShort}-${matchId}`

    setScores((current) => ({
      ...current,
      [scoreKey]: {
        teamA: current[scoreKey]?.teamA ?? '',
        teamB: current[scoreKey]?.teamB ?? '',
        [key]: safeValue,
      },
    }))
  }

  return (
    <section className="spring-league-page container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-2">Spring League</h1>
      </header>

      <Tabs
        id="spring-league-divisions"
        activeKey={activeTab}
        onSelect={(key) => {
          if (key) {
            setActiveTab(key)
          }
        }}
        className="mb-3"
      >
        {divisionSchedules.map((division) => (
          <Tab
            key={division.division_short}
            eventKey={division.division_short}
            title={`${division.division_short} (${division.division_name})`}
          >
            <div className="card shadow-sm border-0">
              <div className="card-body d-flex flex-column gap-3">
                <div className="d-flex flex-column flex-md-row justify-content-between gap-2">
                  <h2 className="h5 mb-0">{division.division_name}</h2>
                  <span className="text-body-secondary small">{division.division_short}</span>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  {division.teams.slice(0, 4).map((team, index) => (
                    <TeamBadge
                      key={team.team_name}
                      teamLabel={String.fromCharCode(65 + index) as 'A' | 'B' | 'C' | 'D'}
                      team={team}
                    />
                  ))}
                </div>

                <div className="spring-league-schedule-stack">
                  <div className="spring-league-special-block">
                    <span className="fw-semibold">18:00 - 18:20</span>
                    <span className="text-body-secondary">Warmup</span>
                  </div>

                  {division.matches.map((match) => {
                    const scoreKey = `${division.division_short}-${match.id}`

                    return (
                      <article key={match.id} className="spring-league-match-card">
                        <header className="spring-league-match-header">
                          <span className="fw-semibold">{match.start} - {match.end}</span>
                          <span className="small text-body-secondary">{match.id.toUpperCase()}</span>
                        </header>

                        <div className="spring-league-match-row">
                          <span className="small text-body-secondary">Team A</span>
                          <TeamBadge teamLabel={match.teamALabel} team={match.teamA} />
                        </div>

                        <div className="spring-league-match-row">
                          <span className="small text-body-secondary">Team B</span>
                          <TeamBadge teamLabel={match.teamBLabel} team={match.teamB} />
                        </div>

                        <div className="spring-league-match-row">
                          <span className="small text-body-secondary">Ref</span>
                          <TeamBadge teamLabel={match.refLabel} team={match.ref} />
                        </div>

                        <div className="spring-league-score-grid">
                          <label className="spring-league-score-field">
                            <span className="small text-body-secondary">Score A</span>
                            <input
                              aria-label={`${division.division_short} ${match.id} score for team A`}
                              className="form-control form-control-sm spring-league-score-input"
                              type="number"
                              min={0}
                              value={scores[scoreKey]?.teamA ?? ''}
                              onChange={(event) => handleScoreChange(division.division_short, match.id, 'teamA', event.currentTarget.value)}
                            />
                          </label>

                          <label className="spring-league-score-field">
                            <span className="small text-body-secondary">Score B</span>
                            <input
                              aria-label={`${division.division_short} ${match.id} score for team B`}
                              className="form-control form-control-sm spring-league-score-input"
                              type="number"
                              min={0}
                              value={scores[scoreKey]?.teamB ?? ''}
                              onChange={(event) => handleScoreChange(division.division_short, match.id, 'teamB', event.currentTarget.value)}
                            />
                          </label>
                        </div>
                      </article>
                    )
                  })}

                  <div className="spring-league-special-block">
                    <span className="fw-semibold">21:50 - 22:00</span>
                    <span className="text-body-secondary">Closedown</span>
                  </div>
                </div>
              </div>
            </div>
          </Tab>
        ))}
      </Tabs>

      <Outlet />
    </section>
  )
}
