import { desc, eq, inArray, sql } from 'drizzle-orm'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'

import { db } from '@/db/client'
import { players, twoVsTwoGames, type Player, type TwoVsTwoGame } from '@/schema'

const MIN_PLAYERS_FOR_GAME = 4

type RegisterGameInput = {
  teamAPlayer1Id: number
  teamAPlayer2Id: number
  teamBPlayer1Id: number
  teamBPlayer2Id: number
  scoreTeamA: number
  scoreTeamB: number
}

type DeleteGameInput = {
  id: number
  edit: string
}

type RegisterGameFormState = {
  teamAPlayer1Id: number
  teamAPlayer2Id: number
  teamBPlayer1Id: number
  teamBPlayer2Id: number
  scoreTeamA: string
  scoreTeamB: string
}

type GameWithNames = TwoVsTwoGame & {
  teamAPlayer1Name: string
  teamAPlayer2Name: string
  teamBPlayer1Name: string
  teamBPlayer2Name: string
}

type LoaderData = {
  players: Player[]
  games: GameWithNames[]
}

function rankingSwingFromDiff(diff: number): number {
  if (diff < 3) return 1
  if (diff <= 7) return 2
  if (diff <= 12) return 3
  return 4
}

function assertValidScore(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
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

const loadGamesPageData = createServerFn({ method: 'GET' }).handler(async (): Promise<LoaderData> => {
  const playerRows = await db.select().from(players).orderBy(players.id)
  const gameRows = await db.select().from(twoVsTwoGames).orderBy(desc(twoVsTwoGames.id)).limit(50)

  const namesById = toPlayerNameMap(playerRows)

  const gamesWithNames: GameWithNames[] = gameRows.map((game) => ({
    ...game,
    teamAPlayer1Name: namesById.get(game.teamAPlayer1Id) ?? `#${game.teamAPlayer1Id}`,
    teamAPlayer2Name: namesById.get(game.teamAPlayer2Id) ?? `#${game.teamAPlayer2Id}`,
    teamBPlayer1Name: namesById.get(game.teamBPlayer1Id) ?? `#${game.teamBPlayer1Id}`,
    teamBPlayer2Name: namesById.get(game.teamBPlayer2Id) ?? `#${game.teamBPlayer2Id}`,
  }))

  return {
    players: playerRows,
    games: gamesWithNames,
  }
})

const registerGame = createServerFn({ method: 'POST' })
  .inputValidator((input: RegisterGameInput) => input)
  .handler(async ({ data }) => {
    assertValidScore(data.scoreTeamA, 'scoreTeamA')
    assertValidScore(data.scoreTeamB, 'scoreTeamB')

    if (data.scoreTeamA === data.scoreTeamB) {
      throw new Error('Games cannot end in a tie.')
    }

    const uniquePlayerIds = [
      data.teamAPlayer1Id,
      data.teamAPlayer2Id,
      data.teamBPlayer1Id,
      data.teamBPlayer2Id,
    ]

    const uniqueCount = new Set(uniquePlayerIds).size
    if (uniqueCount !== 4) {
      throw new Error('All four selected players must be different.')
    }

    const diff = Math.abs(data.scoreTeamA - data.scoreTeamB)
    const swing = rankingSwingFromDiff(diff)
    const teamAWon = data.scoreTeamA > data.scoreTeamB

    const winners = teamAWon
      ? [data.teamAPlayer1Id, data.teamAPlayer2Id]
      : [data.teamBPlayer1Id, data.teamBPlayer2Id]
    const losers = teamAWon
      ? [data.teamBPlayer1Id, data.teamBPlayer2Id]
      : [data.teamAPlayer1Id, data.teamAPlayer2Id]

    await db.transaction(async (tx) => {
      const playersInGame = await tx
        .select()
        .from(players)
        .where(inArray(players.id, uniquePlayerIds))

      if (playersInGame.length !== 4) {
        throw new Error('One or more selected players do not exist.')
      }

      await tx.insert(twoVsTwoGames).values({
        teamAPlayer1Id: data.teamAPlayer1Id,
        teamAPlayer2Id: data.teamAPlayer2Id,
        teamBPlayer1Id: data.teamBPlayer1Id,
        teamBPlayer2Id: data.teamBPlayer2Id,
        scoreTeamA: data.scoreTeamA,
        scoreTeamB: data.scoreTeamB,
      })

      for (const playerId of uniquePlayerIds) {
        const playerInTeamA = playerId === data.teamAPlayer1Id || playerId === data.teamAPlayer2Id
        const pointsForDelta = playerInTeamA ? data.scoreTeamA : data.scoreTeamB
        const pointsAgainstDelta = playerInTeamA ? data.scoreTeamB : data.scoreTeamA
        const rankingDelta = winners.includes(playerId) ? swing : -swing

        await tx
          .update(players)
          .set({
            ranking: sql`${players.ranking} + ${rankingDelta}`,
            pointsFor: sql`${players.pointsFor} + ${pointsForDelta}`,
            pointsAgainst: sql`${players.pointsAgainst} + ${pointsAgainstDelta}`,
            coefficient: sql`
              CASE
                WHEN (${players.pointsAgainst} + ${pointsAgainstDelta}) = 0 THEN NULL
                ELSE ROUND(((${players.pointsFor} + ${pointsForDelta})::numeric / (${players.pointsAgainst} + ${pointsAgainstDelta})::numeric), 4)
              END
            `,
          })
          .where(eq(players.id, playerId))
      }
    })

    const playerRows = await db.select().from(players).orderBy(players.id)
    const gameRows = await db.select().from(twoVsTwoGames).orderBy(desc(twoVsTwoGames.id)).limit(50)
    const namesById = toPlayerNameMap(playerRows)

    return {
      players: playerRows,
      games: gameRows.map((game) => ({
        ...game,
        teamAPlayer1Name: namesById.get(game.teamAPlayer1Id) ?? `#${game.teamAPlayer1Id}`,
        teamAPlayer2Name: namesById.get(game.teamAPlayer2Id) ?? `#${game.teamAPlayer2Id}`,
        teamBPlayer1Name: namesById.get(game.teamBPlayer1Id) ?? `#${game.teamBPlayer1Id}`,
        teamBPlayer2Name: namesById.get(game.teamBPlayer2Id) ?? `#${game.teamBPlayer2Id}`,
      })),
    }
  })

const deleteGame = createServerFn({ method: 'POST' })
  .inputValidator((input: DeleteGameInput) => input)
  .handler(async ({ data }) => {
    if (data.edit !== 'banana') {
      throw new Error('Edition is not allowed.')
    }

    await db.transaction(async (tx) => {
      const game = await tx.query.twoVsTwoGames.findFirst({
        where: eq(twoVsTwoGames.id, data.id),
      })

      if (!game) {
        throw new Error('Game not found.')
      }

      const uniquePlayerIds = [
        game.teamAPlayer1Id,
        game.teamAPlayer2Id,
        game.teamBPlayer1Id,
        game.teamBPlayer2Id,
      ]

      const diff = Math.abs(game.scoreTeamA - game.scoreTeamB)
      const swing = rankingSwingFromDiff(diff)
      const teamAWon = game.scoreTeamA > game.scoreTeamB

      const winners = teamAWon
        ? [game.teamAPlayer1Id, game.teamAPlayer2Id]
        : [game.teamBPlayer1Id, game.teamBPlayer2Id]

      for (const playerId of uniquePlayerIds) {
        const playerInTeamA =
          playerId === game.teamAPlayer1Id || playerId === game.teamAPlayer2Id
        const pointsForDelta = playerInTeamA ? game.scoreTeamA : game.scoreTeamB
        const pointsAgainstDelta = playerInTeamA ? game.scoreTeamB : game.scoreTeamA
        const rankingDelta = winners.includes(playerId) ? -swing : swing

        await tx
          .update(players)
          .set({
            ranking: sql`${players.ranking} + ${rankingDelta}`,
            pointsFor: sql`${players.pointsFor} - ${pointsForDelta}`,
            pointsAgainst: sql`${players.pointsAgainst} - ${pointsAgainstDelta}`,
            coefficient: sql`
              CASE
                WHEN (${players.pointsAgainst} - ${pointsAgainstDelta}) = 0 THEN NULL
                ELSE ROUND(((${players.pointsFor} - ${pointsForDelta})::numeric / (${players.pointsAgainst} - ${pointsAgainstDelta})::numeric), 4)
              END
            `,
          })
          .where(eq(players.id, playerId))
      }

      await tx.delete(twoVsTwoGames).where(eq(twoVsTwoGames.id, data.id))
    })

    const playerRows = await db.select().from(players).orderBy(players.id)
    const gameRows = await db.select().from(twoVsTwoGames).orderBy(desc(twoVsTwoGames.id)).limit(50)
    const namesById = toPlayerNameMap(playerRows)

    return {
      players: playerRows,
      games: gameRows.map((game) => ({
        ...game,
        teamAPlayer1Name: namesById.get(game.teamAPlayer1Id) ?? `#${game.teamAPlayer1Id}`,
        teamAPlayer2Name: namesById.get(game.teamAPlayer2Id) ?? `#${game.teamAPlayer2Id}`,
        teamBPlayer1Name: namesById.get(game.teamBPlayer1Id) ?? `#${game.teamBPlayer1Id}`,
        teamBPlayer2Name: namesById.get(game.teamBPlayer2Id) ?? `#${game.teamBPlayer2Id}`,
      })),
    }
  })

export const Route = createFileRoute('/2v2-mix-n-match/games')({
  head: () => ({
    meta: [{ title: '2v2 Mix n Match Games | JustPlay' }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined,
  }),
  loader: async () => loadGamesPageData(),
  component: TwoVsTwoGamesPage,
})

function TwoVsTwoGamesPage() {
  const loaderData = Route.useLoaderData()
  const search = Route.useSearch()
  const [playerRows, setPlayerRows] = useState<Player[]>(loaderData.players)
  const [games, setGames] = useState<GameWithNames[]>(loaderData.games)
  const [form, setForm] = useState<RegisterGameFormState>({
    teamAPlayer1Id: 0,
    teamAPlayer2Id: 0,
    teamBPlayer1Id: 0,
    teamBPlayer2Id: 0,
    scoreTeamA: '',
    scoreTeamB: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingGameId, setDeletingGameId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const hasEnoughPlayers = playerRows.length >= MIN_PLAYERS_FOR_GAME
  const canEdit = search.edit === 'banana'

  const sortedByRanking = useMemo(
    () =>
      [...playerRows].sort((a, b) => {
        if (b.ranking !== a.ranking) return b.ranking - a.ranking
        return a.name.localeCompare(b.name)
      }),
    [playerRows],
  )

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasEnoughPlayers) {
      setErrorMessage('You need at least 4 players to register a game.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const payload: RegisterGameInput = {
        teamAPlayer1Id: form.teamAPlayer1Id,
        teamAPlayer2Id: form.teamAPlayer2Id,
        teamBPlayer1Id: form.teamBPlayer1Id,
        teamBPlayer2Id: form.teamBPlayer2Id,
        scoreTeamA: scoreInputToNumber(form.scoreTeamA),
        scoreTeamB: scoreInputToNumber(form.scoreTeamB),
      }

      const updated = await registerGame({ data: payload })
      setPlayerRows(updated.players)
      setGames(updated.games)
      setForm((current) => ({
        ...current,
        scoreTeamA: '',
        scoreTeamB: '',
      }))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not register game.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onDeleteGame = async (game: GameWithNames) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete game #${game.id}? Rankings and stats will be reverted.`,
    )

    if (!confirmed) {
      return
    }

    setErrorMessage('')
    setDeletingGameId(game.id)

    try {
      const updated = await deleteGame({
        data: {
          id: game.id,
          edit: search.edit ?? '',
        },
      })

      setPlayerRows(updated.players)
      setGames(updated.games)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not delete game.')
    } finally {
      setDeletingGameId(null)
    }
  }

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">2v2 Mix n Match Games</h1>
        <p className="text-body-secondary mb-0">
          Register 2v2 mix n match games and automatically update ranking, PF, PA and coefficient.
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
        <Link className="btn btn-outline-secondary" to="/2v2-mix-n-match/lower-pool" search={{ edit: undefined }}>
          Lower Pool
        </Link>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-5">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">Register Game</h2>

              {!hasEnoughPlayers ? (
                <p className="text-warning mb-0">Create at least 4 players first in /2v2-mix-n-match/players.</p>
              ) : (
                <form onSubmit={onSubmit} className="d-flex flex-column gap-3">
                  <div className="row g-3">
                    <div className="col-12 col-lg-6">
                      <article className="border rounded p-3 h-100">
                        <h3 className="h6 mb-3">Team A</h3>

                        <div className="d-flex flex-column gap-3">
                          <div>
                            <label htmlFor="teamAPlayer1" className="form-label mb-1">
                              P1
                            </label>
                            <select
                              id="teamAPlayer1"
                              className="form-select"
                              value={form.teamAPlayer1Id}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, teamAPlayer1Id: Number(event.target.value) }))
                              }
                              required
                            >
                              <option value={0}>Select player</option>
                              {playerRows.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label htmlFor="teamAPlayer2" className="form-label mb-1">
                              P2
                            </label>
                            <select
                              id="teamAPlayer2"
                              className="form-select"
                              value={form.teamAPlayer2Id}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, teamAPlayer2Id: Number(event.target.value) }))
                              }
                              required
                            >
                              <option value={0}>Select player</option>
                              {playerRows.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label htmlFor="scoreTeamA" className="form-label mb-1">
                              Score
                            </label>
                            <input
                              id="scoreTeamA"
                              type="number"
                              className="form-control"
                              min={0}
                              step={1}
                              value={form.scoreTeamA}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, scoreTeamA: event.target.value }))
                              }
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </article>
                    </div>

                    <div className="col-12 col-lg-6">
                      <article className="border rounded p-3 h-100">
                        <h3 className="h6 mb-3">Team B</h3>

                        <div className="d-flex flex-column gap-3">
                          <div>
                            <label htmlFor="teamBPlayer1" className="form-label mb-1">
                              P1
                            </label>
                            <select
                              id="teamBPlayer1"
                              className="form-select"
                              value={form.teamBPlayer1Id}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, teamBPlayer1Id: Number(event.target.value) }))
                              }
                              required
                            >
                              <option value={0}>Select player</option>
                              {playerRows.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label htmlFor="teamBPlayer2" className="form-label mb-1">
                              P2
                            </label>
                            <select
                              id="teamBPlayer2"
                              className="form-select"
                              value={form.teamBPlayer2Id}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, teamBPlayer2Id: Number(event.target.value) }))
                              }
                              required
                            >
                              <option value={0}>Select player</option>
                              {playerRows.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label htmlFor="scoreTeamB" className="form-label mb-1">
                              Score
                            </label>
                            <input
                              id="scoreTeamB"
                              type="number"
                              className="form-control"
                              min={0}
                              step={1}
                              value={form.scoreTeamB}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, scoreTeamB: event.target.value }))
                              }
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </article>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-banana"
                    disabled={
                      isSubmitting ||
                      !form.teamAPlayer1Id ||
                      !form.teamAPlayer2Id ||
                      !form.teamBPlayer1Id ||
                      !form.teamBPlayer2Id
                    }
                  >
                    {isSubmitting ? 'Registering...' : 'Register Game'}
                  </button>

                  {errorMessage ? <p className="text-danger mb-0">{errorMessage}</p> : null}
                </form>
              )}
            </div>
          </div>

          <div className="card shadow-sm mt-4">
            <div className="card-body">
              <h2 className="h5 mb-3">Scoring Rules</h2>
              <ul className="mb-0">
                <li>Diff &lt; 3: winners +1, losers -1</li>
                <li>Diff 3-7: winners +2, losers -2</li>
                <li>Diff 8-12: winners +3, losers -3</li>
                <li>Diff &gt; 12: winners +4, losers -4</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <h2 className="h5 mb-3">Players Ranking</h2>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Player</th>
                      <th scope="col" className="text-end">Ranking</th>
                      <th scope="col" className="text-end">PF</th>
                      <th scope="col" className="text-end">PA</th>
                      <th scope="col" className="text-end">Coef.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByRanking.map((player) => (
                      <tr key={player.id}>
                        <td>{player.name}</td>
                        <td className="text-end">{player.ranking}</td>
                        <td className="text-end">{player.pointsFor}</td>
                        <td className="text-end">{player.pointsAgainst}</td>
                        <td className="text-end">{player.coefficient ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">Recent Games</h2>

              {games.length === 0 ? (
                <p className="text-body-secondary mb-0">No games registered yet.</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {games.map((game) => (
                    <article key={game.id} className="border rounded p-3">
                      <header className="mb-3 d-flex justify-content-between align-items-center gap-2">
                        <h3 className="h6 mb-0">Game #{game.id}</h3>
                        {canEdit ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => onDeleteGame(game)}
                            disabled={deletingGameId === game.id}
                          >
                            {deletingGameId === game.id ? 'Deleting...' : 'Delete'}
                          </button>
                        ) : null}
                      </header>

                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <article className="bg-body-tertiary rounded p-3 h-100">
                            <h4 className="h6 mb-2">
                              {`Team A / ${game.scoreTeamA > game.scoreTeamB ? '+' : '-'}${rankingSwingFromDiff(Math.abs(game.scoreTeamA - game.scoreTeamB))}`}
                            </h4>
                            <ul className="mb-0 ps-3">
                              <li>P1: {game.teamAPlayer1Name}</li>
                              <li>P2: {game.teamAPlayer2Name}</li>
                              <li>Score: {game.scoreTeamA}</li>
                            </ul>
                          </article>
                        </div>

                        <div className="col-12 col-md-6">
                          <article className="bg-body-tertiary rounded p-3 h-100">
                            <h4 className="h6 mb-2">
                              {`Team B / ${game.scoreTeamB > game.scoreTeamA ? '+' : '-'}${rankingSwingFromDiff(Math.abs(game.scoreTeamA - game.scoreTeamB))}`}
                            </h4>
                            <ul className="mb-0 ps-3">
                              <li>P1: {game.teamBPlayer1Name}</li>
                              <li>P2: {game.teamBPlayer2Name}</li>
                              <li>Score: {game.scoreTeamB}</li>
                            </ul>
                          </article>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
