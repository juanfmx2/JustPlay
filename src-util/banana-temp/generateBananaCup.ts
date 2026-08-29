import { and, eq } from 'drizzle-orm'

import { db } from '../../src/db/client'
import { competitions, stages } from '../../src/schema/competition'
import { divisions } from '../../src/schema/division'
import { games, gameSets } from '../../src/schema/game'
import { organizations } from '../../src/schema/organization'
import { standings } from '../../src/schema/standings'
import { teams } from '../../src/schema/team'
import { courts, venues } from '../../src/schema/venue'

const ORGANIZATION_SLUG = 'banana-cup'
const ORGANIZATION_NAME = 'Banana Cup'

const COMPETITION_SLUG = 'banana-cup'
const COMPETITION_NAME = 'Banana Cup'

const STAGE_SLUG = 'saturday-29-08'
const STAGE_NAME = 'Saturday 29/08'

const DIVISION_LEVEL = 'A'
const DIVISION_URL_SLUG = 'a'

const VENUE_NAME = 'Banana Cup Venue'
const VENUE_DESCRIPTION = 'Banana Cup temporary venue'
const COURT_NAME = 'Court 1'

const MATCH_DATE = '2026-08-29'
const MATCH_START_TIME = '13:15'
const MATCH_END_TIME = '16:00'
const INTERMISSION_MINUTES = 2

const TEAM_NAMES = ['Apple', 'Banana', 'Carrot'] as const

// One round-robin cycle: A vs B (C refs), B vs C (A refs), A vs C (B refs).
const ROUND_ROBIN_FIXTURES: Array<{ team1: string; team2: string; referee: string }> = [
	{ team1: 'Apple', team2: 'Banana', referee: 'Carrot' },
	{ team1: 'Banana', team2: 'Carrot', referee: 'Apple' },
	{ team1: 'Apple', team2: 'Carrot', referee: 'Banana' },
]

const ROUND_ROBIN_REPEATS = 3

function toDateTime(date: string, time: string): Date {
	return new Date(`${date}T${time}:00+01:00`)
}

function parseTimeToMinutes(time: string): number {
	const [hourRaw, minuteRaw] = time.split(':')
	return Number(hourRaw) * 60 + Number(minuteRaw)
}

function minutesToTime(totalMinutes: number): string {
	const hour = Math.floor(totalMinutes / 60)
	const minute = totalMinutes % 60
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * Splits the available playing window evenly across all matches so the schedule
 * starts at MATCH_START_TIME and ends exactly at MATCH_END_TIME, leaving
 * INTERMISSION_MINUTES between consecutive matches.
 */
function buildMatchDurationsMinutes(matchCount: number): number[] {
	const totalWindowMinutes = parseTimeToMinutes(MATCH_END_TIME) - parseTimeToMinutes(MATCH_START_TIME)
	const totalIntermissionMinutes = INTERMISSION_MINUTES * Math.max(0, matchCount - 1)
	const totalPlayMinutes = totalWindowMinutes - totalIntermissionMinutes

	if (totalPlayMinutes < matchCount) {
		throw new Error('Not enough time between start and end for the requested number of matches.')
	}

	const baseDuration = Math.floor(totalPlayMinutes / matchCount)
	const remainder = totalPlayMinutes - baseDuration * matchCount

	// Distribute the remaining minutes across the first matches so the total adds up exactly.
	return Array.from({ length: matchCount }, (_, index) =>
		index < remainder ? baseDuration + 1 : baseDuration,
	)
}

async function getOrCreateOrganization() {
	const existing = await db.query.organizations.findFirst({
		where: eq(organizations.urlSlug, ORGANIZATION_SLUG),
	})
	if (existing) return existing

	const [created] = await db
		.insert(organizations)
		.values({
			name: ORGANIZATION_NAME,
			urlSlug: ORGANIZATION_SLUG,
			description: ORGANIZATION_NAME,
			contactEmail: 'contact@banana-cup.local',
		})
		.returning()

	return created
}

async function getOrCreateCompetition(organizationId: number) {
	const existing = await db.query.competitions.findFirst({
		where: eq(competitions.urlSlug, COMPETITION_SLUG),
	})
	if (existing) return existing

	const [created] = await db
		.insert(competitions)
		.values({
			organizationId,
			name: COMPETITION_NAME,
			description: COMPETITION_NAME,
			type: 'SINGLE_DAY',
			format: 'Round Robin',
			urlSlug: COMPETITION_SLUG,
		})
		.returning()

	return created
}

async function getOrCreateStage(competitionId: number) {
	const existing = await db.query.stages.findFirst({
		where: and(eq(stages.competitionId, competitionId), eq(stages.urlSlug, STAGE_SLUG)),
	})
	if (existing) return existing

	const [created] = await db
		.insert(stages)
		.values({
			competitionId,
			name: STAGE_NAME,
			description: STAGE_NAME,
			urlSlug: STAGE_SLUG,
			type: 'PLAY',
		})
		.returning()

	return created
}

async function getOrCreateDivision(stageId: number) {
	const existing = await db.query.divisions.findFirst({
		where: and(eq(divisions.stageId, stageId), eq(divisions.level, DIVISION_LEVEL)),
	})
	if (existing) return existing

	const [created] = await db
		.insert(divisions)
		.values({
			stageId,
			name: `${COMPETITION_NAME} - Division ${DIVISION_LEVEL}`,
			description: STAGE_NAME,
			level: DIVISION_LEVEL,
			type: 'MIXED',
			urlSlug: DIVISION_URL_SLUG,
		})
		.returning()

	return created
}

async function getOrCreateVenue() {
	const existing = await db.query.venues.findFirst({
		where: eq(venues.name, VENUE_NAME),
	})
	if (existing) return existing

	const [created] = await db
		.insert(venues)
		.values({ name: VENUE_NAME, description: VENUE_DESCRIPTION })
		.returning()

	return created
}

async function getOrCreateCourt(venueId: number) {
	const existing = await db.query.courts.findFirst({
		where: and(eq(courts.venueId, venueId), eq(courts.name, COURT_NAME)),
	})
	if (existing) return existing

	const [created] = await db
		.insert(courts)
		.values({ venueId, name: COURT_NAME })
		.returning()

	return created
}

async function getOrCreateTeam(divisionId: number, name: string) {
	const urlSlug = `${COMPETITION_SLUG}-${name.toLowerCase()}`
	const existing = await db.query.teams.findFirst({
		where: eq(teams.urlSlug, urlSlug),
	})
	if (existing) return existing

	const [created] = await db
		.insert(teams)
		.values({ divisionId, name, urlSlug })
		.returning()

	return created
}

async function regenerateStandingsForStage(stageId: number, divisionId: number, teamIds: number[]) {
	await db.delete(standings).where(and(eq(standings.stageId, stageId), eq(standings.divisionId, divisionId)))

	await db.insert(standings).values(
		teamIds.map((teamId) => ({
			stageId,
			divisionId,
			teamId,
		})),
	)

	return teamIds.length
}

async function run() {
	const organization = await getOrCreateOrganization()
	const competition = await getOrCreateCompetition(organization.id)
	const stage = await getOrCreateStage(competition.id)
	const division = await getOrCreateDivision(stage.id)
	const venue = await getOrCreateVenue()
	const court = await getOrCreateCourt(venue.id)

	const teamsByName = new Map<string, { id: number; name: string }>()
	for (const teamName of TEAM_NAMES) {
		const team = await getOrCreateTeam(division.id, teamName)
		teamsByName.set(teamName, team)
	}

	function getTeamOrThrow(name: string) {
		const team = teamsByName.get(name)
		if (!team) throw new Error(`Team ${name} not found.`)
		return team
	}

	await db.delete(games).where(eq(games.divisionId, division.id))

	const fixtures = Array.from({ length: ROUND_ROBIN_REPEATS }, () => ROUND_ROBIN_FIXTURES).flat()
	const matchDurations = buildMatchDurationsMinutes(fixtures.length)

	let matchStartMinutes = parseTimeToMinutes(MATCH_START_TIME)
	let totalGames = 0
	let totalGameSets = 0

	for (let index = 0; index < fixtures.length; index += 1) {
		const fixture = fixtures[index]
		const duration = matchDurations[index]

		const teamA = getTeamOrThrow(fixture.team1)
		const teamB = getTeamOrThrow(fixture.team2)
		const referee = getTeamOrThrow(fixture.referee)

		const gameStartTime = toDateTime(MATCH_DATE, minutesToTime(matchStartMinutes))
		const gameEndTime = toDateTime(MATCH_DATE, minutesToTime(matchStartMinutes + duration))

		const [game] = await db
			.insert(games)
			.values({
				divisionId: division.id,
				teamAId: teamA.id,
				teamBId: teamB.id,
				reffingTeamId: referee.id,
				name: `${DIVISION_LEVEL} - ${teamA.name} vs ${teamB.name}`,
				description: `${STAGE_NAME} | 1 set | estimated ${duration} min`,
				startTime: gameStartTime,
				endTime: gameEndTime,
			})
			.returning()

		await db.insert(gameSets).values({
			gameId: game.id,
			courtId: court.id,
			name: 'Set 1',
			description: `${STAGE_NAME} scheduled set`,
			startTime: gameStartTime,
			endTime: gameEndTime,
		})

		totalGames += 1
		totalGameSets += 1
		matchStartMinutes += duration + INTERMISSION_MINUTES
	}

	const totalStandings = await regenerateStandingsForStage(
		stage.id,
		division.id,
		Array.from(teamsByName.values()).map((team) => team.id),
	)

	console.log(
		`Generated ${STAGE_SLUG} for ${competition.urlSlug}: games=${totalGames}, gameSets=${totalGameSets}, standings=${totalStandings}`,
	)
}

await run()
