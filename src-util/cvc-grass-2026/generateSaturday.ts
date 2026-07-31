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

const COMPETITION_SLUG = 'cvc-grass-2026'

const SATURDAY_DATE = '2026-08-01'
const SATURDAY_START_TIME = '09:30'
const SATURDAY_STAGE_SLUG = 'saturday-2026-08-01'
const SATURDAY_STAGE_NAME = 'Saturday 1 August 2026'
const SATURDAY_STAGE_DESCRIPTION = 'CVC Grass 2026 - Saturday fixtures'

const SATURDAY_VENUE_NAME = 'CVC Grass Saturday Venue'
const SATURDAY_VENUE_DESCRIPTION = 'Courts used for Saturday matchday fixtures'

const SETS_PER_MATCH = 3
const POINTS_PER_MINUTE = 2.5
const SET_BREAK_MINUTES = 1
const ASSUMED_EXTRA_POINTS_FOR_UNCAPPED_SETS = 4

const SATURDAY_DATA_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../data/saturday',
)

type PoolGender = 'MEN' | 'MIXED'

type SaturdayMatch = {
	match: number
	team_1: string
	team_2: string
	referee: string
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
	matches: SaturdayMatch[]
}

type NewScheduledDivision = {
	name: string
	level: string
	type: 'MEN' | 'WOMEN' | 'MIXED'
}

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

function getPoolGenderFromDivisionLevel(level: string): PoolGender {
	if (level.startsWith('MX-')) return 'MIXED'
	if (level.startsWith('M-')) return 'MEN'
	throw new Error(`Unsupported division level prefix for ${level}. Expected M- or MX-.`)
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

function getUniqueTeamNames(matches: SaturdayMatch[]): string[] {
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

async function loadSaturdayDivisionFiles(): Promise<DivisionFile[]> {
	const files = (await readdir(SATURDAY_DATA_DIR))
		.filter((name) => name.endsWith('-matches.json'))
		.sort((a, b) => a.localeCompare(b))

	const divisionsLoaded: DivisionFile[] = []

	for (const fileName of files) {
		const divisionLevel = fileName.replace(/-matches\.json$/, '')
		const raw = await readFile(path.join(SATURDAY_DATA_DIR, fileName), 'utf8')
		const parsed = JSON.parse(raw) as SaturdayMatch[]

		if (!Array.isArray(parsed) || parsed.length === 0) {
			throw new Error(`No matches found in ${fileName}.`)
		}

		divisionsLoaded.push({
			divisionLevel,
			matches: parsed,
		})
	}

	if (divisionsLoaded.length === 0) {
		throw new Error(`No Saturday match files found in ${SATURDAY_DATA_DIR}.`)
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

async function getRegistrationStageOrThrow(competitionId: number, registrationStageId: number | null) {
	const stage = registrationStageId
		? await db.query.stages.findFirst({
				where: and(
					eq(stages.id, registrationStageId),
					eq(stages.competitionId, competitionId),
				),
			})
		: await db.query.stages.findFirst({
				where: and(eq(stages.competitionId, competitionId), eq(stages.type, 'REGISTRATION')),
			})

	if (!stage) {
		throw new Error('Registration stage not found for CVC Grass 2026.')
	}

	return stage
}

async function getOrCreateSaturdayStage(competitionId: number) {
	const existing = await db.query.stages.findFirst({
		where: and(eq(stages.competitionId, competitionId), eq(stages.urlSlug, SATURDAY_STAGE_SLUG)),
	})

	if (existing) {
		return existing
	}

	const [created] = await db
		.insert(stages)
		.values({
			competitionId,
			name: SATURDAY_STAGE_NAME,
			description: SATURDAY_STAGE_DESCRIPTION,
			urlSlug: SATURDAY_STAGE_SLUG,
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

async function getCourtOrCreateForDivision(divisionLevel: string) {
	const venue = await getOrCreateVenue(SATURDAY_VENUE_NAME, SATURDAY_VENUE_DESCRIPTION)
	return getOrCreateCourt(venue.id, `Court ${divisionLevel}`)
}

async function getTeamByNameOrThrow(
	divisionId: number,
	divisionLevel: string,
	teamName: string,
) {
	const divisionTeams = await db.query.teams.findMany({
		where: eq(teams.divisionId, divisionId),
	})

	const normalizedTarget = normalizeTeamName(teamName)
	const found = divisionTeams.find(
		(team) => normalizeTeamName(team.name) === normalizedTarget,
	)

	if (!found) {
		throw new Error(
			`Team ${teamName} not found in division ${divisionLevel}. Available teams: ${divisionTeams
				.map((team) => team.name)
				.join(', ')}`,
		)
	}

	return found
}

async function getOrCreateSaturdayDivision(stageId: number, sourceDivision: NewScheduledDivision) {
	const existing = await db.query.divisions.findFirst({
		where: and(eq(divisions.stageId, stageId), eq(divisions.level, sourceDivision.level)),
	})

	if (existing) {
		return existing
	}

	const [created] = await db
		.insert(divisions)
		.values({
			stageId,
			name: sourceDivision.name,
			description: `Saturday fixtures - ${sourceDivision.level}`,
			level: sourceDivision.level,
			type: sourceDivision.type,
			urlSlug: `${sourceDivision.level.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		})
		.returning()

	return created
}

async function getRegistrationDivisionByLevelOrThrow(stageId: number, level: string) {
	const division = await db.query.divisions.findFirst({
		where: and(eq(divisions.stageId, stageId), eq(divisions.level, level)),
	})

	if (!division) {
		throw new Error(`Registration division not found for level ${level}.`)
	}

	return division
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
	const registrationStage = await getRegistrationStageOrThrow(
		competition.id,
		competition.registrationStageId,
	)

	const saturdayStage = await getOrCreateSaturdayStage(competition.id)
	const divisionFiles = await loadSaturdayDivisionFiles()
	const matchRuleProfiles = buildMatchRuleProfilesFromRules(rulesData as RulesData)

	let totalGames = 0
	let totalGameSets = 0

	for (const divisionFile of divisionFiles) {
		const sourceDivision = await getRegistrationDivisionByLevelOrThrow(
			registrationStage.id,
			divisionFile.divisionLevel,
		)

		const scheduledDivision = await getOrCreateSaturdayDivision(saturdayStage.id, {
			name: sourceDivision.name,
			level: sourceDivision.level,
			type: sourceDivision.type,
		})

		await db.delete(games).where(eq(games.divisionId, scheduledDivision.id))

		const court = await getCourtOrCreateForDivision(divisionFile.divisionLevel)

		const uniqueTeamNames = getUniqueTeamNames(divisionFile.matches)
		const poolSize = uniqueTeamNames.length
		const poolGender = getPoolGenderFromDivisionLevel(divisionFile.divisionLevel)
		const ruleProfile = getRuleProfile(poolSize, poolGender, matchRuleProfiles)

		if (SETS_PER_MATCH !== ruleProfile.setRules.length) {
			throw new Error(
				`Expected ${SETS_PER_MATCH} sets, but rule profile ${ruleProfile.label} has ${ruleProfile.setRules.length}.`,
			)
		}

		const setDurations = getSetDurationsMinutes(ruleProfile.setRules)
		const setDurationSum = setDurations.reduce((sum, value) => sum + value, 0)
		const totalSetBreaks = SET_BREAK_MINUTES * Math.max(0, SETS_PER_MATCH - 1)
		const matchDurationMinutes = setDurationSum + totalSetBreaks

		let matchStartMinutes = parseTimeToMinutes(SATURDAY_START_TIME)

		for (const fixture of divisionFile.matches.sort((a, b) => a.match - b.match)) {
			const teamA = await getTeamByNameOrThrow(
				sourceDivision.id,
				divisionFile.divisionLevel,
				fixture.team_1,
			)
			const teamB = await getTeamByNameOrThrow(
				sourceDivision.id,
				divisionFile.divisionLevel,
				fixture.team_2,
			)
			const referee = await getTeamByNameOrThrow(
				sourceDivision.id,
				divisionFile.divisionLevel,
				fixture.referee,
			)

			const setTimes = buildSetTimesForMatch(
				SATURDAY_DATE,
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
					description: `${SATURDAY_STAGE_NAME} | ${ruleProfile.label} | estimated ${matchDurationMinutes} min`,
					startTime: gameStartTime,
					endTime: gameEndTime,
				})
				.returning()

			await db.insert(gameSets).values(
				setTimes.map((setTime, index) => ({
					gameId: game.id,
					courtId: court.id,
					name: `Set ${index + 1}`,
					description: `${SATURDAY_STAGE_NAME} scheduled set`,
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
		`Generated ${SATURDAY_STAGE_SLUG} for ${competition.urlSlug}: games=${totalGames}, gameSets=${totalGameSets}, standings=${totalStandings}`,
	)
}

await run()
