import * as fs from 'fs'
import path from 'path'
import { useMemo, useState } from 'react'
import { Dropdown, SplitButton } from 'react-bootstrap'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import playersData from '../../../data/players.json'
import teamsData from '../../../data/teams.json'
import { PlayerCard } from '../../components/PlayerCard.tsx'

type PlayerInput = {
  id?: string
  player_name: string
  position: string
  level: string
}

type Player = {
  id: string
  player_name: string
  position: string
  level: string
}

type SavedTeams = Record<TeamName, Player[]>

const TEAM_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'] as const
type TeamName = (typeof TEAM_NAMES)[number]
const LEVEL_OPTIONS = [
  'Beginner',
  'Intermediate',
  'CVA Low',
  'CVA High',
  'NVL Low',
  'NVL High',
] as const
type LevelOption = (typeof LEVEL_OPTIONS)[number]
const ALL_FILTER_VALUE = 'all'

type DragSource = {
  playerId: string
  from: 'pool' | TeamName
}

const typedPlayers = playersData as PlayerInput[]

const toSafeIdBase = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const initialPlayers: Player[] = typedPlayers.map((player, index) => ({
  id: player.id ?? `${toSafeIdBase(player.player_name)}-${index + 1}`,
  ...player,
}))

const INITIAL_TEAMS: Record<TeamName, string[]> = {
  A: [],
  B: [],
  C: [],
  D: [],
  E: [],
  F: [],
}

const typedTeams = teamsData as Partial<Record<TeamName, PlayerInput[]>>

const savedPlayersById = new Map(
  TEAM_NAMES.flatMap((teamName) =>
    (typedTeams[teamName] ?? []).map((player) => [player.id, player] as const),
  ).filter((entry): entry is readonly [string, PlayerInput] => entry[0] !== undefined),
)

const initialPlayersFromSavedTeams: Player[] = initialPlayers.map((player) => {
  const savedPlayer = savedPlayersById.get(player.id)

  if (!savedPlayer) {
    return player
  }

  return {
    ...player,
    player_name: savedPlayer.player_name,
    position: savedPlayer.position,
    level: savedPlayer.level,
  }
})

const INITIAL_TEAMS_FROM_FILE: Record<TeamName, string[]> = TEAM_NAMES.reduce(
  (result, teamName) => {
    result[teamName] = (typedTeams[teamName] ?? [])
      .map((player) => player.id)
      .filter((playerId): playerId is string => playerId !== undefined)

    return result
  },
  { ...INITIAL_TEAMS },
)

const savePlayers = createServerFn({ method: 'POST' })
  .inputValidator((players: Player[]) => players)
  .handler(async ({ data }) => {
    const filePath = path.resolve(process.cwd(), 'data/players.json')
    await fs.promises.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')

    return {
      savedCount: data.length,
      filePath,
    }
  })

const saveTeams = createServerFn({ method: 'POST' })
  .inputValidator((teams: SavedTeams) => teams)
  .handler(async ({ data }) => {
    const filePath = path.resolve(process.cwd(), 'data/teams.json')
    await fs.promises.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')

    return {
      savedCount: Object.values(data).reduce((count, teamPlayers) => count + teamPlayers.length, 0),
      filePath,
    }
  })

export const Route = createFileRoute('/old/teams-organizer')({
  component: TeamsOrganizer,
})

function TeamsOrganizer() {
  const [players, setPlayers] = useState<Player[]>(initialPlayersFromSavedTeams)
  const [teams, setTeams] = useState<Record<TeamName, string[]>>(INITIAL_TEAMS_FROM_FILE)
  const [dragging, setDragging] = useState<DragSource | null>(null)
  const [positionFilter, setPositionFilter] = useState<string>(ALL_FILTER_VALUE)
  const [levelFilter, setLevelFilter] = useState<string>(ALL_FILTER_VALUE)
  const [isSavingPlayers, setIsSavingPlayers] = useState(false)
  const [isSavingTeams, setIsSavingTeams] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<string>('')
  const [saveError, setSaveError] = useState<string>('')

  const playersById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player]))
  }, [players])

  const assignedPlayerIds = useMemo(() => {
    return new Set(Object.values(teams).flat())
  }, [teams])

  const availablePlayers = useMemo(() => {
    return players.filter((player) => !assignedPlayerIds.has(player.id))
  }, [assignedPlayerIds, players])

  const positionOptions = useMemo(() => {
    return Array.from(new Set(players.map((player) => player.position))).sort()
  }, [players])

  const levelFilterOptions = useMemo(() => {
    const existingLevels = new Set(players.map((player) => player.level))
    const extraLevels = Array.from(existingLevels)
      .filter((level) => !LEVEL_OPTIONS.includes(level as LevelOption))
      .sort()

    return [...LEVEL_OPTIONS, ...extraLevels]
  }, [players])

  const filteredPlayers = useMemo(() => {
    return availablePlayers.filter((player) => {
      const positionMatch =
        positionFilter === ALL_FILTER_VALUE || player.position === positionFilter
      const levelMatch =
        levelFilter === ALL_FILTER_VALUE || player.level === levelFilter
      return positionMatch && levelMatch
    })
  }, [availablePlayers, positionFilter, levelFilter])

  const getFilterTitle = (value: string, allLabel: string) => {
    return value === ALL_FILTER_VALUE ? allLabel : value
  }

  const onDragStart = (playerId: string, from: 'pool' | TeamName) => {
    setDragging({ playerId, from })
  }

  const clearDragState = () => {
    setDragging(null)
  }

  const findPlayerById = (playerId: string) => {
    return playersById.get(playerId)
  }

  const removePlayerFromSource = (
    state: Record<TeamName, string[]>,
    source: DragSource,
  ) => {
    if (source.from === 'pool') {
      return state
    }

    return {
      ...state,
      [source.from]: state[source.from].filter((id) => id !== source.playerId),
    }
  }

  const updatePlayerField = (
    playerId: string,
    field: 'position' | 'level',
    value: string,
  ) => {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, [field]: value } : player,
      ),
    )
  }

  const handleSavePlayers = async () => {
    setIsSavingPlayers(true)
    setSaveFeedback('')
    setSaveError('')

    try {
      const response = await savePlayers({ data: players })
      setSaveFeedback(
        `Saved ${response.savedCount} players (with ids) to data/players.json.`,
      )
    } catch {
      setSaveError('Could not save players.json. Please try again.')
    } finally {
      setIsSavingPlayers(false)
    }
  }

  const handleSaveTeams = async () => {
    setIsSavingTeams(true)
    setSaveFeedback('')
    setSaveError('')

    try {
      const teamsToSave = TEAM_NAMES.reduce((result, teamName) => {
        result[teamName] = teams[teamName]
          .map((playerId) => playersById.get(playerId))
          .filter((player): player is Player => player !== undefined)

        return result
      }, {} as SavedTeams)

      const response = await saveTeams({ data: teamsToSave })
      setSaveFeedback(
        `Saved ${response.savedCount} assigned players to data/teams.json.`,
      )
    } catch {
      setSaveError('Could not save teams.json. Please try again.')
    } finally {
      setIsSavingTeams(false)
    }
  }

  const dropOnTeam = (teamName: TeamName) => {
    if (!dragging) {
      return
    }

    setTeams((current) => {
      const player = findPlayerById(dragging.playerId)
      if (!player) {
        return current
      }

      if (
        dragging.from === teamName &&
        current[teamName].includes(player.id)
      ) {
        return current
      }

      const withoutSource = removePlayerFromSource(current, dragging)
      const alreadyInTarget = withoutSource[teamName].includes(player.id)

      if (alreadyInTarget) {
        return withoutSource
      }

      return {
        ...withoutSource,
        [teamName]: [...withoutSource[teamName], player.id],
      }
    })

    clearDragState()
  }

  const dropOnPool = () => {
    if (!dragging || dragging.from === 'pool') {
      clearDragState()
      return
    }

    setTeams((current) => removePlayerFromSource(current, dragging))
    clearDragState()
  }

  return (
    <section className="container-fluid teams-organizer-page">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">Teams Organizer</h1>
          <p className="text-body-secondary mb-0">
            Drag players from the pool into teams A-F.
          </p>
        </div>

        <div className="d-flex flex-column flex-sm-row gap-2">
          <button
            type="button"
            className="btn btn-banana"
            onClick={handleSavePlayers}
            disabled={isSavingPlayers || isSavingTeams}
          >
            {isSavingPlayers ? 'Saving...' : 'Save Players'}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleSaveTeams}
            disabled={isSavingPlayers || isSavingTeams}
          >
            {isSavingTeams ? 'Saving...' : 'Save Teams'}
          </button>
        </div>
      </div>

      {saveFeedback !== '' && (
        <div className="alert alert-success" role="status">
          {saveFeedback}
        </div>
      )}

      {saveError !== '' && (
        <div className="alert alert-danger" role="alert">
          {saveError}
        </div>
      )}

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-4">
              <label htmlFor="positionFilter" className="form-label fw-semibold">
                Position
              </label>
              <SplitButton
                id="positionFilter"
                className="organizer-split-button"
                title={getFilterTitle(positionFilter, 'All positions')}
                variant="banana"
                onClick={() => setPositionFilter(ALL_FILTER_VALUE)}
              >
                <Dropdown.Item
                  active={positionFilter === ALL_FILTER_VALUE}
                  onClick={() => setPositionFilter(ALL_FILTER_VALUE)}
                >
                  All positions
                </Dropdown.Item>
                {positionOptions.map((position) => (
                  <Dropdown.Item
                    key={position}
                    active={positionFilter === position}
                    onClick={() => setPositionFilter(position)}
                  >
                    {position}
                  </Dropdown.Item>
                ))}
              </SplitButton>
            </div>

            <div className="col-12 col-md-4">
              <label htmlFor="levelFilter" className="form-label fw-semibold">
                Level
              </label>
              <SplitButton
                id="levelFilter"
                className="organizer-split-button"
                title={getFilterTitle(levelFilter, 'All levels')}
                variant="banana"
                onClick={() => setLevelFilter(ALL_FILTER_VALUE)}
              >
                <Dropdown.Item
                  active={levelFilter === ALL_FILTER_VALUE}
                  onClick={() => setLevelFilter(ALL_FILTER_VALUE)}
                >
                  All levels
                </Dropdown.Item>
                {levelFilterOptions.map((level) => (
                  <Dropdown.Item
                    key={level}
                    active={levelFilter === level}
                    onClick={() => setLevelFilter(level)}
                  >
                    {level}
                  </Dropdown.Item>
                ))}
              </SplitButton>
            </div>

            <div className="col-12 col-md-4">
              <div className="alert alert-banana mb-0 small">
                Showing <strong>{filteredPlayers.length}</strong> of{' '}
                <strong>{availablePlayers.length}</strong> available players
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="card shadow-sm border-0 mb-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={dropOnPool}
      >
        <div className="card-header bg-transparent border-0 pt-3 px-3 pb-0">
          <h2 className="h5 mb-0">Available Players</h2>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {filteredPlayers.map((player) => (
              <div key={player.id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                <PlayerCard
                  player={player}
                  positionOptions={positionOptions}
                  levelOptions={LEVEL_OPTIONS}
                  onPositionChange={(value: string) =>
                    updatePlayerField(player.id, 'position', value)
                  }
                  onLevelChange={(value: string) =>
                    updatePlayerField(player.id, 'level', value)
                  }
                  draggable
                  compact={false}
                  readOnly={false}
                  onDragStart={() => onDragStart(player.id, 'pool')}
                  onDragEnd={clearDragState}
                />
              </div>
            ))}

            {filteredPlayers.length === 0 && (
              <div className="col-12">
                <div className="alert alert-banana mb-0">
                  No players match the selected filters.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="row g-3">
        {TEAM_NAMES.map((teamName) => (
          <div key={teamName} className="col-12 col-md-6 col-xl-4">
            <section
              className={`card shadow-sm border-0 team-drop-zone h-100 team-${teamName.toLowerCase()}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOnTeam(teamName)}
            >
              <div className="card-header d-flex justify-content-between align-items-center">
                <h2 className="h5 mb-0">Team {teamName}</h2>
                <span className="badge badge-banana">{teams[teamName].length}</span>
              </div>
              <div className="card-body">
                {teams[teamName].length === 0 && (
                  <p className="text-body-secondary mb-0 small">
                    Drop players here.
                  </p>
                )}

                <div className="d-flex flex-column gap-2">
                  {teams[teamName].map((playerId) => {
                    const player = playersById.get(playerId)
                    if (!player) {
                      return null
                    }

                    return (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        positionOptions={positionOptions}
                        levelOptions={LEVEL_OPTIONS}
                        onPositionChange={(value: string) =>
                          updatePlayerField(player.id, 'position', value)
                        }
                        onLevelChange={(value: string) =>
                          updatePlayerField(player.id, 'level', value)
                        }
                        draggable
                        compact
                        readOnly={true}
                        onDragStart={() => onDragStart(player.id, teamName)}
                        onDragEnd={clearDragState}
                      />
                    )
                  })}
                </div>
              </div>
            </section>
          </div>
        ))}
      </div>
    </section>
  )
}