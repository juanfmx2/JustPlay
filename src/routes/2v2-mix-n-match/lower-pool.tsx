import { and, desc, eq, inArray } from 'drizzle-orm'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'

import { db } from '@/db/client'
import { players, twoVsTwoBracketGames, type Player, type TwoVsTwoBracketGame } from '@/schema'

type TeamLabel = 'A' | 'B' | 'C' | 'D'
type BracketMatchKey = 'sf1' | 'sf2' | 'final' | 'thirdPlace'
type BracketPool = 'lower'

type PoolTeam = {
  label: TeamLabel
  player1Id: number | null
  player2Id: number | null
  player1: string
  player2: string
  isComplete: boolean
}

type BracketGameWithNames = TwoVsTwoBracketGame & {
  teamAPlayer1Name: string
  teamAPlayer2Name: string
  teamBPlayer1Name: string
  teamBPlayer2Name: string
}

type ScoreState = {
  scoreTeamA: string
  scoreTeamB: string
}

type ScoreFormState = Record<BracketMatchKey, ScoreState>

type SaveLowerPoolMatchInput = {
  matchKey: BracketMatchKey
  teamAPlayer1Id: number
  teamAPlayer2Id: number
  teamBPlayer1Id: number
  teamBPlayer2Id: number
  scoreTeamA: number
  scoreTeamB: number
}

const LOWER_POOL: BracketPool = 'lower'
const BRACKET_MATCH_KEYS: BracketMatchKey[] = ['sf1', 'sf2', 'final', 'thirdPlace']

const TEAM_LABELS: TeamLabel[] = ['A', 'B', 'C', 'D']
const TEAM_ASSIGNMENTS = [
  [0, 7],
  [1, 6],
  [2, 5],
  [3, 4],
] as const

function isBracketMatchKey(value: string): value is BracketMatchKey {
  return BRACKET_MATCH_KEYS.includes(value as BracketMatchKey)
}

function scoreInputToNumber(value: string): number {
  const normalized = value.trim()
  if (!normalized) return 0

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Scores must be non-negative integers.')
  }

  return parsed
}

function toPlayerNameMap(playerRows: Player[]): Map<number, string> {
  return new Map(playerRows.map((player) => [player.id, player.name]))
}

function toBracketGamesWithNames(
  gameRows: TwoVsTwoBracketGame[],
  namesById: Map<number, string>,
): BracketGameWithNames[] {
  return gameRows.map((game) => ({
    ...game,
    teamAPlayer1Name: namesById.get(game.teamAPlayer1Id) ?? `#${game.teamAPlayer1Id}`,
    teamAPlayer2Name: namesById.get(game.teamAPlayer2Id) ?? `#${game.teamAPlayer2Id}`,
    teamBPlayer1Name: namesById.get(game.teamBPlayer1Id) ?? `#${game.teamBPlayer1Id}`,
    teamBPlayer2Name: namesById.get(game.teamBPlayer2Id) ?? `#${game.teamBPlayer2Id}`,
  }))
}

function initialScoreForm(games: BracketGameWithNames[]): ScoreFormState {
  const byKey = new Map(games.map((game) => [game.matchKey, game]))

  return {
    sf1: {
      scoreTeamA: String(byKey.get('sf1')?.scoreTeamA ?? ''),
      scoreTeamB: String(byKey.get('sf1')?.scoreTeamB ?? ''),
    },
    sf2: {
      scoreTeamA: String(byKey.get('sf2')?.scoreTeamA ?? ''),
      scoreTeamB: String(byKey.get('sf2')?.scoreTeamB ?? ''),
    },
    final: {
      scoreTeamA: String(byKey.get('final')?.scoreTeamA ?? ''),
      scoreTeamB: String(byKey.get('final')?.scoreTeamB ?? ''),
    },
    thirdPlace: {
      scoreTeamA: String(byKey.get('thirdPlace')?.scoreTeamA ?? ''),
      scoreTeamB: String(byKey.get('thirdPlace')?.scoreTeamB ?? ''),
    },
  }
}

function matchTitle(matchKey: BracketMatchKey): string {
  if (matchKey === 'sf1') return 'Semifinal 1'
  if (matchKey === 'sf2') return 'Semifinal 2'
  if (matchKey === 'final') return 'Final'
  return '3rd Place'
}

function teamPlayersLine(team: PoolTeam | null): string {
  if (!team || !team.isComplete) return 'TBC'
  return `${team.player1} / ${team.player2}`
}

function winnerFromGame(
  game: BracketGameWithNames | undefined,
  leftTeam: PoolTeam,
  rightTeam: PoolTeam,
): PoolTeam | null {
  if (!game || game.scoreTeamA === game.scoreTeamB) return null
  return game.scoreTeamA > game.scoreTeamB ? leftTeam : rightTeam
}

function loserFromGame(
  game: BracketGameWithNames | undefined,
  leftTeam: PoolTeam,
  rightTeam: PoolTeam,
): PoolTeam | null {
  if (!game || game.scoreTeamA === game.scoreTeamB) return null
  return game.scoreTeamA > game.scoreTeamB ? rightTeam : leftTeam
}

const loadLowerPool = createServerFn({ method: 'GET' }).handler(async () => {
  const rankedPlayers = await db
    .select()
    .from(players)
    .orderBy(desc(players.ranking), desc(players.coefficient), players.id)

  const bracketGames = await db
    .select()
    .from(twoVsTwoBracketGames)
    .where(eq(twoVsTwoBracketGames.pool, LOWER_POOL))
  const namesById = toPlayerNameMap(rankedPlayers)

  return {
    rankedPlayers,
    bracketGames: toBracketGamesWithNames(bracketGames, namesById),
  }
})

const saveLowerPoolMatch = createServerFn({ method: 'POST' })
  .inputValidator((input: SaveLowerPoolMatchInput) => input)
  .handler(async ({ data }) => {
    if (!isBracketMatchKey(data.matchKey)) {
      throw new Error('Invalid match key.')
    }

    if (data.scoreTeamA === data.scoreTeamB) {
      throw new Error('Games cannot end in a tie.')
    }

    for (const [label, value] of [
      ['Team A score', data.scoreTeamA],
      ['Team B score', data.scoreTeamB],
    ] as const) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative integer.`)
      }
    }

    const uniquePlayerIds = [
      data.teamAPlayer1Id,
      data.teamAPlayer2Id,
      data.teamBPlayer1Id,
      data.teamBPlayer2Id,
    ]
    if (new Set(uniquePlayerIds).size !== 4) {
      throw new Error('All four selected players must be different.')
    }

    await db.transaction(async (tx) => {
      const playersInMatch = await tx
        .select()
        .from(players)
        .where(inArray(players.id, uniquePlayerIds))

      if (playersInMatch.length !== 4) {
        throw new Error('One or more selected players do not exist.')
      }

      if (data.matchKey === 'sf1' || data.matchKey === 'sf2') {
        await tx
          .delete(twoVsTwoBracketGames)
          .where(
            and(
              eq(twoVsTwoBracketGames.pool, LOWER_POOL),
              inArray(twoVsTwoBracketGames.matchKey, ['final', 'thirdPlace']),
            ),
          )
      }

      await tx
        .insert(twoVsTwoBracketGames)
        .values({
          pool: LOWER_POOL,
          matchKey: data.matchKey,
          teamAPlayer1Id: data.teamAPlayer1Id,
          teamAPlayer2Id: data.teamAPlayer2Id,
          teamBPlayer1Id: data.teamBPlayer1Id,
          teamBPlayer2Id: data.teamBPlayer2Id,
          scoreTeamA: data.scoreTeamA,
          scoreTeamB: data.scoreTeamB,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [twoVsTwoBracketGames.pool, twoVsTwoBracketGames.matchKey],
          set: {
            teamAPlayer1Id: data.teamAPlayer1Id,
            teamAPlayer2Id: data.teamAPlayer2Id,
            teamBPlayer1Id: data.teamBPlayer1Id,
            teamBPlayer2Id: data.teamBPlayer2Id,
            scoreTeamA: data.scoreTeamA,
            scoreTeamB: data.scoreTeamB,
            updatedAt: new Date(),
          },
        })
    })

    const rankedPlayers = await db
      .select()
      .from(players)
      .orderBy(desc(players.ranking), desc(players.coefficient), players.id)
    const bracketGames = await db
      .select()
      .from(twoVsTwoBracketGames)
      .where(eq(twoVsTwoBracketGames.pool, LOWER_POOL))

    return {
      bracketGames: toBracketGamesWithNames(bracketGames, toPlayerNameMap(rankedPlayers)),
    }
  })

function buildTeams(poolPlayers: Player[]): PoolTeam[] {
  return TEAM_LABELS.map((label, idx) => {
    const [leftIdx, rightIdx] = TEAM_ASSIGNMENTS[idx]
    const left = poolPlayers[leftIdx]
    const right = poolPlayers[rightIdx]

    return {
      label,
      player1Id: left?.id ?? null,
      player2Id: right?.id ?? null,
      player1: left ? left.name : 'TBC',
      player2: right ? right.name : 'TBC',
      isComplete: Boolean(left && right),
    }
  })
}

export const Route = createFileRoute('/2v2-mix-n-match/lower-pool')({
  head: () => ({
    meta: [{ title: 'Lower Pool | 2v2 Mix n\' Match Mini Cup | JustPlay' }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined,
  }),
  loader: async () => loadLowerPool(),
  component: LowerPoolPage,
})

function LowerPoolPage() {
  const { rankedPlayers, bracketGames: initialBracketGames } = Route.useLoaderData()
  const search = Route.useSearch()
  const lowerPlayers = rankedPlayers.slice(8, 16)
  const teams = buildTeams(lowerPlayers)
  const hasCompletePool = lowerPlayers.length === 8
  const canEdit = search.edit === 'banana'
  const [bracketGames, setBracketGames] = useState<BracketGameWithNames[]>(initialBracketGames)
  const [scores, setScores] = useState<ScoreFormState>(initialScoreForm(initialBracketGames))
  const [savingKey, setSavingKey] = useState<BracketMatchKey | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const teamA = teams[0]
  const teamB = teams[1]
  const teamC = teams[2]
  const teamD = teams[3]

  const gamesByKey = useMemo(() => {
    const mapped: Partial<Record<BracketMatchKey, BracketGameWithNames>> = {}
    for (const game of bracketGames) {
      if (isBracketMatchKey(game.matchKey)) {
        mapped[game.matchKey] = game
      }
    }
    return mapped
  }, [bracketGames])

  const sf1Winner = winnerFromGame(gamesByKey.sf1, teamA, teamD)
  const sf1Loser = loserFromGame(gamesByKey.sf1, teamA, teamD)
  const sf2Winner = winnerFromGame(gamesByKey.sf2, teamB, teamC)
  const sf2Loser = loserFromGame(gamesByKey.sf2, teamB, teamC)

  const finalTeamA = sf1Winner
  const finalTeamB = sf2Winner
  const thirdPlaceTeamA = sf1Loser
  const thirdPlaceTeamB = sf2Loser

  const onScoreChange = (matchKey: BracketMatchKey, team: 'A' | 'B', value: string) => {
    setScores((current) => ({
      ...current,
      [matchKey]: {
        ...current[matchKey],
        [team === 'A' ? 'scoreTeamA' : 'scoreTeamB']: value,
      },
    }))
  }

  const onSaveMatch = async (matchKey: BracketMatchKey, leftTeam: PoolTeam | null, rightTeam: PoolTeam | null) => {
    if (!canEdit) {
      return
    }

    if (!leftTeam?.isComplete || !rightTeam?.isComplete) {
      setErrorMessage('This matchup is not ready yet. Complete previous matches first.')
      setSuccessMessage('')
      return
    }

    if (
      leftTeam.player1Id === null ||
      leftTeam.player2Id === null ||
      rightTeam.player1Id === null ||
      rightTeam.player2Id === null
    ) {
      setErrorMessage('Could not resolve player ids for this matchup.')
      setSuccessMessage('')
      return
    }

    setErrorMessage('')
    setSuccessMessage('')
    setSavingKey(matchKey)

    try {
      const scoreTeamA = scoreInputToNumber(scores[matchKey].scoreTeamA)
      const scoreTeamB = scoreInputToNumber(scores[matchKey].scoreTeamB)

      if (scoreTeamA === scoreTeamB) {
        throw new Error('Games cannot end in a tie.')
      }

      const updated = await saveLowerPoolMatch({
        data: {
          matchKey,
          teamAPlayer1Id: leftTeam.player1Id,
          teamAPlayer2Id: leftTeam.player2Id,
          teamBPlayer1Id: rightTeam.player1Id,
          teamBPlayer2Id: rightTeam.player2Id,
          scoreTeamA,
          scoreTeamB,
        },
      })

      setBracketGames(updated.bracketGames)
      setScores(initialScoreForm(updated.bracketGames))
      setSuccessMessage(`${matchTitle(matchKey)} score saved.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save this score.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">Lower Pool (Ranks 9-16)</h1>
        <p className="text-body-secondary mb-0">
          Teams are assigned strongest with lowest inside the lower pool: A(9,16), B(10,15),
          C(11,14), D(12,13).
        </p>
      </header>

      <div className="d-flex flex-wrap gap-2 mb-4">
        <Link className="btn btn-banana" to="/2v2-mix-n-match">
          Home
        </Link>
        <Link className="btn btn-outline-secondary" to="/2v2-mix-n-match/players" search={{ edit: undefined }}>
          Players
        </Link>
        <Link className="btn btn-outline-secondary" to="/2v2-mix-n-match/games" search={{ edit: undefined }}>
          Ranking Games
        </Link>
        <Link className="btn btn-outline-secondary" to="/2v2-mix-n-match/upper-pool" search={{ edit: undefined }}>
          Upper Pool
        </Link>
      </div>

      {!hasCompletePool ? (
        <div className="alert alert-warning" role="alert">
          TBC: Need at least 16 ranked players to complete the Lower Pool bracket.
        </div>
      ) : null}

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h5 mb-3">Pool Teams</h2>
          <div className="row g-3">
            {teams.map((team) => (
              <div className="col-12 col-md-6" key={team.label}>
                <article className="border rounded p-3 h-100">
                  <h3 className="h6 mb-2">Team {team.label}</h3>
                  <p className="mb-1">P1: {team.player1}</p>
                  <p className="mb-0">P2: {team.player2}</p>
                  {!team.isComplete ? <p className="text-warning mb-0 mt-2">TBC</p> : null}
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h5 mb-3">Match Format</h2>
          <ul className="mb-0">
            <li>Best of 1 set.</li>
            <li>Set to 30 points, win by 2.</li>
            <li>Hard cap at 40 points.</li>
          </ul>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="h5 mb-3">Bracket Games</h2>

          {errorMessage ? <p className="text-danger mb-3">{errorMessage}</p> : null}
          {successMessage ? <p className="text-success mb-3">{successMessage}</p> : null}

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <article className="border rounded p-3 h-100">
                <h3 className="h6 mb-2">Semifinal 1</h3>
                <p className="mb-1">Team {teamA.label}: {teamPlayersLine(teamA)}</p>
                <p className="mb-3">Team {teamD.label}: {teamPlayersLine(teamD)}</p>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label htmlFor="lower-sf1-score-a" className="form-label small mb-1">Team {teamA.label} score</label>
                    <input
                      id="lower-sf1-score-a"
                      className="form-control"
                      type="number"
                      min={0}
                      step={1}
                      value={scores.sf1.scoreTeamA}
                      onChange={(event) => onScoreChange('sf1', 'A', event.target.value)}
                      placeholder="0"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="col-6">
                    <label htmlFor="lower-sf1-score-b" className="form-label small mb-1">Team {teamD.label} score</label>
                    <input
                      id="lower-sf1-score-b"
                      className="form-control"
                      type="number"
                      min={0}
                      step={1}
                      value={scores.sf1.scoreTeamB}
                      onChange={(event) => onScoreChange('sf1', 'B', event.target.value)}
                      placeholder="0"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-banana"
                    disabled={savingKey !== null || !teamA.isComplete || !teamD.isComplete}
                    onClick={() => onSaveMatch('sf1', teamA, teamD)}
                  >
                    {savingKey === 'sf1' ? 'Saving...' : 'Save Score'}
                  </button>
                ) : null}
                <p className="small text-body-secondary mt-2 mb-0">
                  {gamesByKey.sf1 ? `Recorded score: ${gamesByKey.sf1.scoreTeamA}-${gamesByKey.sf1.scoreTeamB}` : 'Not recorded yet.'}
                </p>
              </article>
            </div>
            <div className="col-12 col-lg-6">
              <article className="border rounded p-3 h-100">
                <h3 className="h6 mb-2">Semifinal 2</h3>
                <p className="mb-1">Team {teamB.label}: {teamPlayersLine(teamB)}</p>
                <p className="mb-3">Team {teamC.label}: {teamPlayersLine(teamC)}</p>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label htmlFor="lower-sf2-score-a" className="form-label small mb-1">Team {teamB.label} score</label>
                    <input
                      id="lower-sf2-score-a"
                      className="form-control"
                      type="number"
                      min={0}
                      step={1}
                      value={scores.sf2.scoreTeamA}
                      onChange={(event) => onScoreChange('sf2', 'A', event.target.value)}
                      placeholder="0"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="col-6">
                    <label htmlFor="lower-sf2-score-b" className="form-label small mb-1">Team {teamC.label} score</label>
                    <input
                      id="lower-sf2-score-b"
                      className="form-control"
                      type="number"
                      min={0}
                      step={1}
                      value={scores.sf2.scoreTeamB}
                      onChange={(event) => onScoreChange('sf2', 'B', event.target.value)}
                      placeholder="0"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-banana"
                    disabled={savingKey !== null || !teamB.isComplete || !teamC.isComplete}
                    onClick={() => onSaveMatch('sf2', teamB, teamC)}
                  >
                    {savingKey === 'sf2' ? 'Saving...' : 'Save Score'}
                  </button>
                ) : null}
                <p className="small text-body-secondary mt-2 mb-0">
                  {gamesByKey.sf2 ? `Recorded score: ${gamesByKey.sf2.scoreTeamA}-${gamesByKey.sf2.scoreTeamB}` : 'Not recorded yet.'}
                </p>
              </article>
            </div>
            <div className="col-12 col-lg-6">
              <article className="border rounded p-3 h-100">
                <h3 className="h6 mb-2">Final</h3>
                <p className="mb-1">Winner SF1: {teamPlayersLine(finalTeamA)}</p>
                <p className="mb-3">Winner SF2: {teamPlayersLine(finalTeamB)}</p>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label htmlFor="lower-final-score-a" className="form-label small mb-1">Winner SF1 score</label>
                    <input
                      id="lower-final-score-a"
                      className="form-control"
                      type="number"
                      min={0}
                      step={1}
                      value={scores.final.scoreTeamA}
                      onChange={(event) => onScoreChange('final', 'A', event.target.value)}
                      placeholder="0"
                      disabled={!canEdit || !finalTeamA || !finalTeamB}
                    />
                  </div>
                  <div className="col-6">
                    <label htmlFor="lower-final-score-b" className="form-label small mb-1">Winner SF2 score</label>
                    <input
                      id="lower-final-score-b"
                      className="form-control"
                      type="number"
                      min={0}
                      step={1}
                      value={scores.final.scoreTeamB}
                      onChange={(event) => onScoreChange('final', 'B', event.target.value)}
                      placeholder="0"
                      disabled={!canEdit || !finalTeamA || !finalTeamB}
                    />
                  </div>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-banana"
                    disabled={savingKey !== null || !finalTeamA || !finalTeamB}
                    onClick={() => onSaveMatch('final', finalTeamA, finalTeamB)}
                  >
                    {savingKey === 'final' ? 'Saving...' : 'Save Score'}
                  </button>
                ) : null}
                <p className="small text-body-secondary mt-2 mb-0">
                  {gamesByKey.final ? `Recorded score: ${gamesByKey.final.scoreTeamA}-${gamesByKey.final.scoreTeamB}` : 'Not recorded yet.'}
                </p>
              </article>
            </div>
            <div className="col-12 col-lg-6">
              <article className="border rounded p-3 h-100">
                <h3 className="h6 mb-2">3rd Place</h3>
                <p className="mb-1">Loser SF1: {teamPlayersLine(thirdPlaceTeamA)}</p>
                <p className="mb-3">Loser SF2: {teamPlayersLine(thirdPlaceTeamB)}</p>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label htmlFor="lower-third-score-a" className="form-label small mb-1">Loser SF1 score</label>
                    <input
                      id="lower-third-score-a"
                      className="form-control"
                      type="number"
                      min={0}
                      step={1}
                      value={scores.thirdPlace.scoreTeamA}
                      onChange={(event) => onScoreChange('thirdPlace', 'A', event.target.value)}
                      placeholder="0"
                      disabled={!canEdit || !thirdPlaceTeamA || !thirdPlaceTeamB}
                    />
                  </div>
                  <div className="col-6">
                    <label htmlFor="lower-third-score-b" className="form-label small mb-1">Loser SF2 score</label>
                    <input
                      id="lower-third-score-b"
                      className="form-control"
                      type="number"
                      min={0}
                      step={1}
                      value={scores.thirdPlace.scoreTeamB}
                      onChange={(event) => onScoreChange('thirdPlace', 'B', event.target.value)}
                      placeholder="0"
                      disabled={!canEdit || !thirdPlaceTeamA || !thirdPlaceTeamB}
                    />
                  </div>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-banana"
                    disabled={savingKey !== null || !thirdPlaceTeamA || !thirdPlaceTeamB}
                    onClick={() => onSaveMatch('thirdPlace', thirdPlaceTeamA, thirdPlaceTeamB)}
                  >
                    {savingKey === 'thirdPlace' ? 'Saving...' : 'Save Score'}
                  </button>
                ) : null}
                <p className="small text-body-secondary mt-2 mb-0">
                  {gamesByKey.thirdPlace ? `Recorded score: ${gamesByKey.thirdPlace.scoreTeamA}-${gamesByKey.thirdPlace.scoreTeamB}` : 'Not recorded yet.'}
                </p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
