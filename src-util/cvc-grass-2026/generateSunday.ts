import { and, eq } from 'drizzle-orm'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { db } from '../../src/db/client'
import { competitions, stages } from '../../src/schema/competition'
import { divisions } from '../../src/schema/division'
import { games, gameSets } from '../../src/schema/game'
import { standings } from '../../src/schema/standings'
import { teams } from '../../src/schema/team'
import { courts, venues } from '../../src/schema/venue'
import rulesData from '../../data/rules.json'

type PoolGender = 'MEN' | 'WOMEN' | 'MIXED'

type SundayMatch = {
  match: number
  team_1: string
  team_2: string
  referee: string
  court: string
}

type RulesGroup = {
  heading: string
  description: string
  rules: Array<{ html: string }>
}

type RulesData = {
  rulesGroups: RulesGroup[]
}

type SetRule = {
  targetPoints: number
  capPoints: number | null
  winByTwo: boolean
}

type MatchRuleProfile = {
  label: string
  setRules: [SetRule, SetRule, SetRule]
}

type DivisionFile = {
  divisionLevel: string
  gender: PoolGender
  divisionNumber: number
  poolSlug: string
  divisionName: string
  poolLabel: string | null
  type: 'MEN' | 'WOMEN' | 'MIXED'
  matches: SundayMatch[]
}

const COMPETITION_SLUG = 'cvc-grass-2026'
const SUNDAY_DATE = '2026-08-02'
const SUNDAY_START_TIME = '08:15'
const SUNDAY_STAGE_SLUG = 'sunday'
const SUNDAY_STAGE_NAME = 'Sunday 2 August 2026'
const SUNDAY_STAGE_DESCRIPTION = 'CVC Grass 2026 - Sunday fixtures'
const SUNDAY_VENUE_NAME = 'CVC Grass 2026 Sunday Venue'
const SUNDAY_VENUE_DESCRIPTION = 'CVC Grass 2026 Sunday fixtures venue'

const SETS_PER_MATCH = 3
const POINTS_PER_MINUTE = 3.5
const SET_BREAK_MINUTES = 1
const ASSUMED_EXTRA_POINTS_FOR_UNCAPPED_SETS = 4

const SUNDAY_DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/sunday',
)

function toDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+01:00`)
}

function normalizeTeamName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
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
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function getGenderLabel(gender: PoolGender): string {
  if (gender === 'MEN') return 'Men'
  if (gender === 'WOMEN') return 'Women'
  return 'Mixed'
}

function getPoolLabel(poolSlug: string): string | null {
  if (/^[a-z]$/i.test(poolSlug)) {
    return `Pool ${poolSlug.toUpperCase()}`
  }

  if (poolSlug.toLowerCase() === 'wooden') {
    return 'Wooden Pool'
  }

  if (poolSlug.toLowerCase() === 'all') {
    return 'All Pool'
  }

  return poolSlug
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function parseSundayDivisionFileName(fileName: string): Omit<DivisionFile, 'matches'> {
  const match = fileName.match(/^(M|MX|W)-(\d+)-(.+)-matches\.json$/i)
  if (!match) {
    throw new Error(
      `Invalid Sunday match file name: ${fileName}. Expected format <gender>-<div_num>-<pool>-matches.json.`,
    )
  }

  const genderCode = match[1].toUpperCase() as 'M' | 'MX' | 'W'
  const divisionNumber = Number(match[2])
  const poolSlug = match[3]

  if (!Number.isInteger(divisionNumber) || divisionNumber <= 0) {
    throw new Error(`Invalid division number in file name: ${fileName}.`)
  }

  const gender: PoolGender = genderCode === 'M' ? 'MEN' : genderCode === 'MX' ? 'MIXED' : 'WOMEN'
  const poolLabel = getPoolLabel(poolSlug)
  const divisionName = `${getGenderLabel(gender)} Division ${divisionNumber}${poolLabel ? ` - ${poolLabel}` : ''}`
  const divisionLevel = `${genderCode}-${divisionNumber}-${poolSlug}`

  return {
    divisionLevel,
    gender,
    divisionNumber,
    poolSlug,
    divisionName,
    poolLabel,
    type: gender,
  }
}

function extractNumbersFromHtml(ruleHtml: string): number[] {
  const matches = [...ruleHtml.matchAll(/<b>\s*(\d+)/g)]
  return matches.map((match) => Number(match[1]))
}

function extractSetRuleFromGroup(group: RulesGroup, setIndex: 1 | 2 | 3): SetRule {
  const line =
    setIndex === 3
      ? group.rules.find((rule) => /third set/i.test(rule.html))
      : group.rules.find((rule) => /first two sets/i.test(rule.html))

  if (!line) {
    throw new Error(`Missing set rule text in rules group ${group.heading}.`)
  }

  const values = extractNumbersFromHtml(line.html)
  if (values.length === 0) {
    throw new Error(`Unable to parse points from rules group ${group.heading}.`)
  }

  const targetPoints = values[0]
  const hasCap = /capped at/i.test(line.html)
  const capPoints = hasCap && values.length > 1 ? values[1] : null
  const winByTwo = !/no win-by-two/i.test(line.html)

  return {
    targetPoints,
    capPoints,
    winByTwo,
  }
}

function getRulesGroupOrThrow(rulesByHeading: Map<string, RulesGroup>, heading: string): RulesGroup {
  const found = rulesByHeading.get(heading)
  if (!found) {
    throw new Error(`Rules heading not found: ${heading}`)
  }
  return found
}

function buildMatchRuleProfilesFromRules(rulesJson: RulesData): Record<string, MatchRuleProfile> {
  const rulesByHeading = new Map(rulesJson.rulesGroups.map((group) => [group.heading, group]))

  const mixedPool5 = getRulesGroupOrThrow(rulesByHeading, 'Pools of 5 - Mixed')
  const menPool5 = getRulesGroupOrThrow(rulesByHeading, 'Pools of 5 - Men')
  const pool4 = getRulesGroupOrThrow(rulesByHeading, 'Pools of 4')

  return {
    'mixed-5': {
      label: mixedPool5.heading,
      setRules: [
        extractSetRuleFromGroup(mixedPool5, 1),
        extractSetRuleFromGroup(mixedPool5, 2),
        extractSetRuleFromGroup(mixedPool5, 3),
      ],
    },
    'men-5': {
      label: menPool5.heading,
      setRules: [
        extractSetRuleFromGroup(menPool5, 1),
        extractSetRuleFromGroup(menPool5, 2),
        extractSetRuleFromGroup(menPool5, 3),
      ],
    },
    'women-5': {
      label: 'Pools of 5 - Women',
      setRules: [
        extractSetRuleFromGroup(mixedPool5, 1),
        extractSetRuleFromGroup(mixedPool5, 2),
        extractSetRuleFromGroup(mixedPool5, 3),
      ],
    },
    'pool-4': {
      label: pool4.heading,
      setRules: [
        extractSetRuleFromGroup(pool4, 1),
        extractSetRuleFromGroup(pool4, 2),
        extractSetRuleFromGroup(pool4, 3),
      ],
    },
  }
}

function getRuleProfile(
  poolSize: number,
  poolGender: PoolGender,
  profiles: Record<string, MatchRuleProfile>,
): MatchRuleProfile {
  if (poolSize === 4) {
    return profiles['pool-4']
  }

  if (poolSize === 5 && poolGender === 'MIXED') {
    return profiles['mixed-5']
  }

  if (poolSize === 5 && poolGender === 'MEN') {
    return profiles['men-5']
  }

  if (poolSize === 5 && poolGender === 'WOMEN') {
    return profiles['women-5']
  }

  throw new Error(
    `No max-point rule mapping configured for pool size ${poolSize} and gender ${poolGender}.`,
  )
}

function getEffectiveCapPoints(setRule: SetRule): number {
  if (setRule.capPoints !== null) {
    return setRule.capPoints
  }

  if (!setRule.winByTwo) {
    return setRule.targetPoints
  }

  return setRule.targetPoints + ASSUMED_EXTRA_POINTS_FOR_UNCAPPED_SETS
}

function getMaxTotalSetPoints(setRule: SetRule): number {
  const winningPoints = getEffectiveCapPoints(setRule)
  const losingPoints = Math.max(0, winningPoints - 1)
  return winningPoints + losingPoints
}

function getSetDurationsMinutes(setRules: [SetRule, SetRule, SetRule]): [number, number, number] {
  return setRules.map((setRule) =>
    Math.max(1, Math.ceil(getMaxTotalSetPoints(setRule) / POINTS_PER_MINUTE)),
  ) as [number, number, number]
}

function buildSetTimesForMatch(
  date: string,
  matchStartMinutes: number,
  setDurationsMinutes: [number, number, number],
): Array<{ startTime: Date; endTime: Date }> {
  let cursor = matchStartMinutes
  const setTimes: Array<{ startTime: Date; endTime: Date }> = []

  for (const duration of setDurationsMinutes) {
    const setStart = cursor
    const setEnd = setStart + duration
    setTimes.push({
      startTime: toDateTime(date, minutesToTime(setStart)),
      endTime: toDateTime(date, minutesToTime(setEnd)),
    })
    cursor = setEnd + SET_BREAK_MINUTES
  }

  return setTimes
}

function getUniqueTeamNames(matches: SundayMatch[]): string[] {
  const unique = new Map<string, string>()

  for (const match of matches) {
    for (const name of [match.team_1, match.team_2, match.referee]) {
      const key = normalizeTeamName(name)
      if (!unique.has(key)) {
        unique.set(key, name)
      }
    }
  }

  return Array.from(unique.values())
}

async function loadSundayDivisionFiles(): Promise<DivisionFile[]> {
  const files = (await readdir(SUNDAY_DATA_DIR))
    .filter((name) => name.endsWith('-matches.json'))
    .sort((a, b) => a.localeCompare(b))

  const divisionsLoaded: DivisionFile[] = []

  for (const fileName of files) {
    const raw = await readFile(path.join(SUNDAY_DATA_DIR, fileName), 'utf8')
    const parsed = JSON.parse(raw) as SundayMatch[]

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`No matches found in ${fileName}.`)
    }

    divisionsLoaded.push({
      ...parseSundayDivisionFileName(fileName),
      matches: parsed,
    })
  }

  if (divisionsLoaded.length === 0) {
    throw new Error(`No Sunday match files found in ${SUNDAY_DATA_DIR}.`)
  }

  return divisionsLoaded
}

async function getCompetitionOrThrow() {
  const competition = await db.query.competitions.findFirst({
    where: eq(competitions.urlSlug, COMPETITION_SLUG),
  })

  if (!competition) {
    throw new Error(`Competition ${COMPETITION_SLUG} not found.`)
  }

  return competition
}

async function getOrCreateSundayStage(competitionId: number) {
  const existing = await db.query.stages.findFirst({
    where: and(eq(stages.competitionId, competitionId), eq(stages.urlSlug, SUNDAY_STAGE_SLUG)),
  })

  if (existing) {
    return existing
  }

  const [created] = await db
    .insert(stages)
    .values({
      competitionId,
      name: SUNDAY_STAGE_NAME,
      description: SUNDAY_STAGE_DESCRIPTION,
      urlSlug: SUNDAY_STAGE_SLUG,
      type: 'PLAY',
    })
    .returning()

  return created
}

async function getOrCreateVenue(name: string, description: string) {
  const venue = await db.query.venues.findFirst({
    where: eq(venues.name, name),
  })

  if (venue) {
    return venue
  }

  const [created] = await db
    .insert(venues)
    .values({
      name,
      description,
    })
    .returning()

  return created
}

async function getOrCreateCourt(venueId: number, name: string) {
  const court = await db.query.courts.findFirst({
    where: and(eq(courts.venueId, venueId), eq(courts.name, name)),
  })

  if (court) {
    return court
  }

  const [created] = await db
    .insert(courts)
    .values({
      venueId,
      name,
    })
    .returning()

  return created
}

async function getCourtOrCreate(courtName: string) {
  const venue = await getOrCreateVenue(SUNDAY_VENUE_NAME, SUNDAY_VENUE_DESCRIPTION)
  return getOrCreateCourt(venue.id, courtName)
}

async function getCompetitionTeamByNameMap(competitionId: number) {
  const allTeams = await db.query.teams.findMany({
    with: {
      division: {
        with: {
          stage: true,
        },
      },
    },
  })

  return new Map(
    allTeams
      .filter((team) => team.division?.stage?.competitionId === competitionId)
      .map((team) => [normalizeTeamName(team.name), team] as const),
  )
}

function getTeamByNameOrThrow(
  teamNameMap: Map<string, Awaited<ReturnType<typeof getCompetitionTeamByNameMap>> extends Map<string, infer Team> ? Team : never>,
  divisionLevel: string,
  teamName: string,
) {
  const found = teamNameMap.get(normalizeTeamName(teamName))
  if (!found) {
    throw new Error(
      `Team ${teamName} not found for Sunday division ${divisionLevel}.`,
    )
  }

  return found
}

async function getOrCreateSundayDivision(stageId: number, sourceDivision: Omit<DivisionFile, 'matches'>) {
  const existing = await db.query.divisions.findFirst({
    where: and(eq(divisions.stageId, stageId), eq(divisions.level, sourceDivision.divisionLevel)),
  })

  if (existing) {
    return existing
  }

  const [created] = await db
    .insert(divisions)
    .values({
      stageId,
      name: sourceDivision.divisionName,
      description: `Sunday fixtures - ${sourceDivision.divisionLevel}`,
      level: sourceDivision.divisionLevel,
      type: sourceDivision.type,
      urlSlug: sourceDivision.divisionLevel.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    })
    .returning()

  return created
}

async function regenerateStandingsForCompetition(competitionId: number) {
  const competitionStages = await db.query.stages.findMany({
    where: and(eq(stages.competitionId, competitionId), eq(stages.type, 'PLAY')),
    with: {
      divisions: {
        with: {
          teams: {
            columns: { id: true },
          },
          games: {
            columns: {
              teamAId: true,
              teamBId: true,
            },
          },
        },
      },
    },
  })

  let standingsRows = 0

  for (const stage of competitionStages) {
    for (const division of stage.divisions) {
      await db
        .delete(standings)
        .where(and(eq(standings.stageId, stage.id), eq(standings.divisionId, division.id)))

      const competingTeamIds = new Set<number>()

      for (const team of division.teams) {
        competingTeamIds.add(team.id)
      }

      for (const game of division.games) {
        competingTeamIds.add(game.teamAId)
        competingTeamIds.add(game.teamBId)
      }

      const records = Array.from(competingTeamIds).map((teamId) => ({
        stageId: stage.id,
        divisionId: division.id,
        teamId,
      }))

      if (records.length > 0) {
        await db.insert(standings).values(records)
        standingsRows += records.length
      }
    }
  }

  return standingsRows
}

async function run() {
  const competition = await getCompetitionOrThrow()
  const sundayStage = await getOrCreateSundayStage(competition.id)
  const divisionFiles = await loadSundayDivisionFiles()
  const matchRuleProfiles = buildMatchRuleProfilesFromRules(rulesData as RulesData)
  const teamNameMap = await getCompetitionTeamByNameMap(competition.id)

  let totalGames = 0
  let totalGameSets = 0

  for (const divisionFile of divisionFiles) {
    const scheduledDivision = await getOrCreateSundayDivision(sundayStage.id, divisionFile)

    await db.delete(games).where(eq(games.divisionId, scheduledDivision.id))

    const uniqueTeamNames = getUniqueTeamNames(divisionFile.matches)
    const poolSize = uniqueTeamNames.length
    const ruleProfile = getRuleProfile(poolSize, divisionFile.gender, matchRuleProfiles)

    if (SETS_PER_MATCH !== ruleProfile.setRules.length) {
      throw new Error(
        `Expected ${SETS_PER_MATCH} sets, but rule profile ${ruleProfile.label} has ${ruleProfile.setRules.length}.`,
      )
    }

    const setDurations = getSetDurationsMinutes(ruleProfile.setRules)
    const setDurationSum = setDurations.reduce((sum, value) => sum + value, 0)
    const totalSetBreaks = SET_BREAK_MINUTES * Math.max(0, SETS_PER_MATCH - 1)
    const matchDurationMinutes = setDurationSum + totalSetBreaks

    let matchStartMinutes = parseTimeToMinutes(SUNDAY_START_TIME)

    for (const fixture of divisionFile.matches.sort((a, b) => a.match - b.match)) {
      const teamA = getTeamByNameOrThrow(teamNameMap, divisionFile.divisionLevel, fixture.team_1)
      const teamB = getTeamByNameOrThrow(teamNameMap, divisionFile.divisionLevel, fixture.team_2)
      const referee = getTeamByNameOrThrow(teamNameMap, divisionFile.divisionLevel, fixture.referee)
      const court = await getCourtOrCreate(`Court ${fixture.court}`)

      const setTimes = buildSetTimesForMatch(
        SUNDAY_DATE,
        matchStartMinutes,
        setDurations,
      )

      const gameStartTime = setTimes[0]?.startTime
      const gameEndTime = setTimes[setTimes.length - 1]?.endTime
      if (!gameStartTime || !gameEndTime) {
        throw new Error(
          `Could not derive game time range for ${divisionFile.divisionLevel} match ${fixture.match}.`,
        )
      }

      const [game] = await db
        .insert(games)
        .values({
          divisionId: scheduledDivision.id,
          teamAId: teamA.id,
          teamBId: teamB.id,
          reffingTeamId: referee.id,
          name: `${scheduledDivision.level} - ${teamA.name} vs ${teamB.name}`,
          description: `${SUNDAY_STAGE_NAME} | ${ruleProfile.label} | estimated ${matchDurationMinutes} min`,
          startTime: gameStartTime,
          endTime: gameEndTime,
        })
        .returning()

      await db.insert(gameSets).values(
        setTimes.map((setTime, index) => ({
          gameId: game.id,
          courtId: court.id,
          name: `Set ${index + 1}`,
          description: `${SUNDAY_STAGE_NAME} scheduled set`,
          startTime: setTime.startTime,
          endTime: setTime.endTime,
        })),
      )

      totalGames += 1
      totalGameSets += SETS_PER_MATCH
      matchStartMinutes += matchDurationMinutes
    }
  }

  const totalStandings = await regenerateStandingsForCompetition(competition.id)

  console.log(
    `Generated ${SUNDAY_STAGE_SLUG} for ${competition.urlSlug}: games=${totalGames}, gameSets=${totalGameSets}, standings=${totalStandings}`,
  )
}

await run()
