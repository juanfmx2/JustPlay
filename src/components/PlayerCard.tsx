import { Dropdown, SplitButton } from 'react-bootstrap'

type PlayerCardProps = {
  player: {
    id: string
    player_name: string
    position: string
    level: string
  }
  positionOptions: readonly string[]
  levelOptions: readonly string[]
  onPositionChange: (value: string) => void
  onLevelChange: (value: string) => void
  draggable?: boolean
  compact?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
}

const getNextOption = (options: readonly string[], currentValue: string) => {
  if (options.length === 0) {
    return currentValue
  }

  const currentIndex = options.indexOf(currentValue)

  if (currentIndex === -1 || currentIndex === options.length - 1) {
    return options[0]
  }

  return options[currentIndex + 1]
}

export function PlayerCard({
  player,
  positionOptions,
  levelOptions,
  onPositionChange,
  onLevelChange,
  draggable = false,
  compact = false,
  onDragStart,
  onDragEnd,
}: PlayerCardProps) {
  const positionId = `position-${player.id}`
  const levelId = `level-${player.id}`

  return (
    <article
      className={`card player-card ${compact ? '' : 'h-100'}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={`card-body ${compact ? 'py-2 px-3' : ''}`}>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <h3 className="mb-0 h6">{player.player_name}</h3>
          <span className="badge badge-banana-subtle">{player.id}</span>
        </div>

        <div className="row g-2">
          <div className="col-6">
            <SplitButton
              id={positionId}
              title={player.position}
              variant="banana"
              size="sm"
              className="organizer-split-button"
              onClick={() =>
                onPositionChange(getNextOption(positionOptions, player.position))
              }
              disabled={positionOptions.length === 0}
            >
              {positionOptions.map((position) => (
                <Dropdown.Item
                  key={position}
                  active={position === player.position}
                  onClick={() => onPositionChange(position)}
                >
                  {position}
                </Dropdown.Item>
              ))}
            </SplitButton>
          </div>

          <div className="col-6">
            <SplitButton
              id={levelId}
              title={player.level}
              variant="banana"
              size="sm"
              className="organizer-split-button"
              onClick={() => onLevelChange(getNextOption(levelOptions, player.level))}
              disabled={levelOptions.length === 0}
            >
              {levelOptions.map((level) => (
                <Dropdown.Item
                  key={level}
                  active={level === player.level}
                  onClick={() => onLevelChange(level)}
                >
                  {level}
                </Dropdown.Item>
              ))}
            </SplitButton>
          </div>
        </div>
      </div>
    </article>
  )
}