import { count, eq, or, sql } from 'drizzle-orm'
import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'

import { db } from '@/db/client'
import { players, twoVsTwoGames, type Player } from '@/schema'

const MAX_PLAYERS = 16
const INITIAL_RANKING = 500

type NewPlayerInput = {
  name: string
  edit: string
}

type DeletePlayerInput = {
  id: number
  edit: string
}

function sortPlayersById(list: Player[]): Player[] {
  return [...list].sort((a, b) => a.id - b.id)
}

const loadPlayers = createServerFn({ method: 'GET' }).handler(async () => {
  const playerRows = await db.select().from(players).orderBy(players.id)
  return playerRows
})

const insertPlayer = createServerFn({ method: 'POST' })
  .inputValidator((input: NewPlayerInput) => input)
  .handler(async ({ data }) => {
    if (data.edit !== 'banana') {
      throw new Error('Edition is not allowed.')
    }

    const name = data.name.trim()
    if (!name) {
      throw new Error('Player name is required.')
    }

    const playerCountResult = await db.select({ value: count() }).from(players)
    const currentCount = playerCountResult[0]?.value ?? 0

    if (currentCount >= MAX_PLAYERS) {
      throw new Error(`Maximum number of players is ${MAX_PLAYERS}.`)
    }

    const existingByName = await db.query.players.findFirst({
      where: (table) => sql`lower(${table.name}) = lower(${name})`,
    })

    if (existingByName) {
      throw new Error('Player name must be unique.')
    }

    const [created] = await db
      .insert(players)
      .values({
        name,
        ranking: INITIAL_RANKING,
      })
      .returning()

    return created
  })

const deletePlayer = createServerFn({ method: 'POST' })
  .inputValidator((input: DeletePlayerInput) => input)
  .handler(async ({ data }) => {
    if (data.edit !== 'banana') {
      throw new Error('Edition is not allowed.')
    }

    const gamesCountResult = await db
      .select({ value: count() })
      .from(twoVsTwoGames)
      .where(
        or(
          eq(twoVsTwoGames.teamAPlayer1Id, data.id),
          eq(twoVsTwoGames.teamAPlayer2Id, data.id),
          eq(twoVsTwoGames.teamBPlayer1Id, data.id),
          eq(twoVsTwoGames.teamBPlayer2Id, data.id),
        ),
      )

    const gamesCount = gamesCountResult[0]?.value ?? 0
    if (gamesCount > 0) {
      throw new Error('Cannot delete a player that has registered games.')
    }

    const [deleted] = await db
      .delete(players)
      .where(eq(players.id, data.id))
      .returning()

    if (!deleted) {
      throw new Error('Player not found.')
    }

    return deleted
  })

export const Route = createFileRoute('/2v2-mix-n-match/players')({
  head: () => ({
    meta: [{ title: '2v2 Mix n Match Players | JustPlay' }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined,
  }),
  loader: async () => loadPlayers(),
  component: TwoVsTwoPlayersPage,
})

function TwoVsTwoPlayersPage() {
  const initialPlayers = Route.useLoaderData()
  const search = Route.useSearch()
  const [playerRows, setPlayerRows] = useState<Player[]>(initialPlayers)
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingPlayerId, setDeletingPlayerId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')
  const canEdit = search.edit === 'banana'

  const canCreateMore = playerRows.length < MAX_PLAYERS
  const remainingSlots = useMemo(() => MAX_PLAYERS - playerRows.length, [playerRows.length])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canCreateMore || !name.trim()) {
      return
    }

    setSaveError('')
    setIsSubmitting(true)

    try {
      const created = await insertPlayer({
        data: {
          name,
          edit: search.edit ?? '',
        },
      })

      setPlayerRows((current) => sortPlayersById([...current, created]))
      setName('')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not create player.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onDelete = async (player: Player) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${player.name}? This action cannot be undone.`,
    )

    if (!confirmed) {
      return
    }

    setSaveError('')
    setDeletingPlayerId(player.id)

    try {
      await deletePlayer({
        data: {
          id: player.id,
          edit: search.edit ?? '',
        },
      })

      setPlayerRows((current) => current.filter((row) => row.id !== player.id))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not delete player.')
    } finally {
      setDeletingPlayerId(null)
    }
  }

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">2v2 Mix n Match Players</h1>
        <p className="text-body-secondary mb-0">
          Add up to {MAX_PLAYERS} players. Every new player starts with ranking {INITIAL_RANKING}.
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
        {canEdit ? (
          <div className="col-12 col-lg-5">
            <div className="card shadow-sm">
              <div className="card-body">
                <h2 className="h5 mb-3">Create Player</h2>

                <form onSubmit={onSubmit} className="d-flex flex-column gap-3">
                  <div>
                    <label htmlFor="playerName" className="form-label">
                      Name
                    </label>
                    <input
                      id="playerName"
                      className="form-control"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Player name"
                      disabled={!canCreateMore || isSubmitting}
                      required
                    />
                  </div>

                  <div className="d-flex align-items-center justify-content-between">
                    <span className="small text-body-secondary">
                      {remainingSlots} slot{remainingSlots === 1 ? '' : 's'} left
                    </span>
                    <button
                      type="submit"
                      className="btn btn-banana"
                      disabled={!canCreateMore || isSubmitting || !name.trim()}
                    >
                      {isSubmitting ? 'Creating...' : 'Create Player'}
                    </button>
                  </div>

                  {saveError ? <p className="text-danger mb-0">{saveError}</p> : null}
                  {!canCreateMore ? (
                    <p className="text-warning mb-0">Player limit reached ({MAX_PLAYERS}).</p>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        ) : null}

        <div className={canEdit ? 'col-12 col-lg-7' : 'col-12'}>
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">Players ({playerRows.length}/{MAX_PLAYERS})</h2>

              {playerRows.length === 0 ? (
                <p className="text-body-secondary mb-0">No players yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">ID</th>
                        <th scope="col">Name</th>
                        <th scope="col" className="text-end">
                          Ranking
                        </th>
                        <th scope="col" className="text-end">
                          PF
                        </th>
                        <th scope="col" className="text-end">
                          PA
                        </th>
                        <th scope="col" className="text-end">
                          Coef.
                        </th>
                        {canEdit ? (
                          <th scope="col" className="text-end">
                            Actions
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {playerRows.map((player) => (
                        <tr key={player.id}>
                          <td>{player.id}</td>
                          <td>{player.name}</td>
                          <td className="text-end">{player.ranking}</td>
                          <td className="text-end">{player.pointsFor}</td>
                          <td className="text-end">{player.pointsAgainst}</td>
                          <td className="text-end">{player.coefficient ?? '-'}</td>
                          {canEdit ? (
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => onDelete(player)}
                                disabled={deletingPlayerId === player.id}
                              >
                                {deletingPlayerId === player.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
