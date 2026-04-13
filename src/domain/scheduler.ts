type TeamLike = {
  id: number
  name: string
}

export type DivisionForScheduling = {
  id: number
  name: string
  teams: TeamLike[]
}

export type ScheduledGame = {
  id: string
  divisionId: number
  divisionName: string
  date: string
  startTime: string
  endTime: string
  teamA: TeamLike
  teamB: TeamLike
}

function parseTimeToMinutes(time: string): number {
  const [hourRaw, minuteRaw] = time.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Invalid time format: ${time}. Expected HH:mm.`)
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time value: ${time}.`)
  }

  return hour * 60 + minute
}

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${hh}:${mm}`
}

function buildRoundRobinPairs(teams: TeamLike[]): Array<[TeamLike, TeamLike]> {
  if (teams.length < 2) {
    return []
  }

  const bye: TeamLike = { id: -1, name: '__BYE__' }
  const participants = teams.length % 2 === 0 ? [...teams] : [...teams, bye]
  const rounds = participants.length - 1
  const half = participants.length / 2
  const pairs: Array<[TeamLike, TeamLike]> = []

  for (let round = 0; round < rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const a = participants[i]
      const b = participants[participants.length - 1 - i]

      if (a.id !== bye.id && b.id !== bye.id) {
        pairs.push([a, b])
      }
    }

    const fixed = participants[0]
    const rotated = participants.slice(1)
    const last = rotated.pop()
    if (!last) continue

    participants.splice(0, participants.length, fixed, last, ...rotated)
  }

  return pairs
}

/**
 * Generates a single round-robin schedule for all teams in a division,
 * distributing game slots evenly between startTime and endTime.
 */
export function generateRoundRobinSchedule(
  division: DivisionForScheduling,
  date: string,
  startTime: string,
  endTime: string,
  setupWarmupMinutes: number,
  intermissionMinutes: number,
  closedownMinutes: number,
): ScheduledGame[] {
  const pairs = buildRoundRobinPairs(division.teams)

  if (pairs.length === 0) {
    return []
  }

  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)

  if (endMinutes <= startMinutes) {
    throw new Error('endTime must be later than startTime.')
  }

  if (setupWarmupMinutes < 0 || intermissionMinutes < 0 || closedownMinutes < 0) {
    throw new Error('setupWarmupMinutes, intermissionMinutes, and closedownMinutes must be >= 0.')
  }

  const totalWindow = endMinutes - startMinutes

  const totalIntermission = intermissionMinutes * Math.max(0, pairs.length - 1)
  const playableWindow = totalWindow - setupWarmupMinutes - closedownMinutes - totalIntermission

  if (playableWindow <= 0) {
    throw new Error('No time left for games after setup/warmup, intermissions, and closedown.')
  }

  const slotLength = Math.max(1, Math.floor(playableWindow / pairs.length))

  let cursor = startMinutes + setupWarmupMinutes

  return pairs.map(([teamA, teamB], index) => {
    const gameStart = cursor
    const gameEnd =
      index === pairs.length - 1
        ? endMinutes - closedownMinutes
        : Math.min(endMinutes - closedownMinutes, gameStart + slotLength)

    cursor = gameEnd + intermissionMinutes

    return {
      id: `${division.id}-${index + 1}`,
      divisionId: division.id,
      divisionName: division.name,
      date,
      startTime: minutesToTime(gameStart),
      endTime: minutesToTime(gameEnd),
      teamA,
      teamB,
    }
  })
}
