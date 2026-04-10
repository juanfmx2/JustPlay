import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

type Match = {
  id: string
  start: string
  end: string
  teamA: string
  teamB: string
  ref: string
}

type DivisionPageProps = {
  divisionName: string
  dayAndLocation: string
  teamStart: number
}

const MATCH_WINDOWS = [
  { start: '19:20', end: '19:40' },
  { start: '19:40', end: '20:00' },
  { start: '20:00', end: '20:20' },
  { start: '20:20', end: '20:40' },
  { start: '20:40', end: '21:00' },
  { start: '21:00', end: '21:20' },
] as const

function buildTeams(teamStart: number) {
  return [
    `Team ${teamStart}`,
    `Team ${teamStart + 1}`,
    `Team ${teamStart + 2}`,
    `Team ${teamStart + 3}`,
  ]
}

function buildRoundRobin(teams: string[]): Match[] {
  const pairs: Array<[number, number]> = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ]

  return pairs.map(([teamAIdx, teamBIdx], index) => {
    const refCandidates = teams.filter((_, teamIndex) => teamIndex !== teamAIdx && teamIndex !== teamBIdx)
    const refTeam = refCandidates[index % refCandidates.length]

    return {
      id: `m${index + 1}`,
      start: MATCH_WINDOWS[index].start,
      end: MATCH_WINDOWS[index].end,
      teamA: teams[teamAIdx],
      teamB: teams[teamBIdx],
      ref: refTeam,
    }
  })
}

export function SpringLeagueDivisionPage({ divisionName, dayAndLocation, teamStart }: DivisionPageProps) {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const teams = useMemo(() => buildTeams(teamStart), [teamStart])
  const matches = useMemo(() => buildRoundRobin(teams), [teams])

  return (
    <section className="container py-4">
      <header className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h1 className="h2 mb-0">{divisionName}</h1>
          <Link to="/spring-league" className="btn btn-outline-secondary btn-sm">
            Back to Schedule
          </Link>
        </div>
        <p className="text-body-secondary mt-2 mb-0">
          {dayAndLocation} - Week {selectedWeek}
        </p>
      </header>

      <div className="card shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="d-flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((week) => (
              <button
                key={week}
                type="button"
                onClick={() => setSelectedWeek(week)}
                className={`btn ${selectedWeek === week ? 'btn-primary' : 'btn-outline-primary'}`}
              >
                Week {week}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h5 mb-3">Teams</h2>
          <div className="row g-2">
            {teams.map((team) => (
              <div key={team} className="col-12 col-md-6">
                <div className="border rounded px-3 py-2 bg-body-tertiary">{team}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="h5 mb-3">Match Day Schedule</h2>
          <ul className="list-group list-group-flush mb-3">
            <li className="list-group-item px-0">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span className="fw-semibold">Warmup and Setup</span>
                <span className="text-body-secondary">19:00 - 19:20</span>
              </div>
            </li>
          </ul>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Match</th>
                  <th scope="col">Ref</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id}>
                    <td>{match.start} - {match.end}</td>
                    <td>{match.teamA} vs {match.teamB}</td>
                    <td>{match.ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
