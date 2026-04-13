import { and, eq } from 'drizzle-orm'

import {
	type DivisionForScheduling,
	generateRoundRobinSchedule,
} from '../src/domain/scheduler'
import { db } from '../src/db/client'
import { competitions, stages } from '../src/schema/competition'
import { divisions } from '../src/schema/division'
import { games, gameSets } from '../src/schema/game'
import { courts, venues } from '../src/schema/venue'

const COMPETITION_SLUG = 'spring-league-2026'

const START_TIME = '18:00'
const END_TIME = '22:00'
const SETUP_WARMUP_MINUTES = 14
const INTERMISSION_MINUTES = 4
const CLOSEDOWN_MINUTES = 2

type DivisionCourtAssignment = {
	divisionLevel: string
	date: string
	venueName: string
	courtName: string
}

const WEEK_1_ASSIGNMENTS: DivisionCourtAssignment[] = [
	{
		divisionLevel: 'Div 1',
		date: '2026-04-23',
		venueName: 'North Cambridge Academy (NCA)',
		courtName: 'Sports Hall',
	},
	{
		divisionLevel: 'Div 2',
		date: '2026-04-24',
		venueName: 'North Cambridge Academy (NCA)',
		courtName: 'Sports Hall',
	},
	{
		divisionLevel: 'Div 3',
		date: '2026-04-24',
		venueName: 'The Perse',
		courtName: 'Sports Hall A',
	},
	{
		divisionLevel: 'Div 4',
		date: '2026-04-24',
		venueName: 'The Perse',
		courtName: 'Sports Hall B',
	},
]

function toDateTime(date: string, time: string): Date {
	return new Date(`${date}T${time}:00+01:00`)
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
		throw new Error('Registration stage not found for Spring League 2026.')
	}

	return stage
}

async function getOrCreateWeek1Stage(competitionId: number) {
	const existing = await db.query.stages.findFirst({
		where: and(eq(stages.competitionId, competitionId), eq(stages.urlSlug, 'week-1')),
	})

	if (existing) {
		return existing
	}

	const [created] = await db
		.insert(stages)
		.values({
			competitionId,
			name: 'Week 1',
			description: 'Spring League 2026 - Week 1 fixtures',
			urlSlug: 'week-1',
			type: 'PLAY',
		})
		.returning()

	return created
}

async function getCourtOrThrow(venueName: string, courtName: string) {
	const venue = await db.query.venues.findFirst({
		where: eq(venues.name, venueName),
	})

	if (!venue) {
		throw new Error(`Venue not found: ${venueName}`)
	}

	const court = await db.query.courts.findFirst({
		where: and(eq(courts.venueId, venue.id), eq(courts.name, courtName)),
	})

	if (!court) {
		throw new Error(`Court not found: ${venueName} / ${courtName}`)
	}

	return court
}

async function getOrCreateWeekDivision(weekStageId: number, sourceDivision: { name: string; level: string; type: 'MEN' | 'WOMEN' | 'MIXED' }) {
	const existing = await db.query.divisions.findFirst({
		where: and(eq(divisions.stageId, weekStageId), eq(divisions.level, sourceDivision.level)),
	})

	if (existing) {
		return existing
	}

	const [created] = await db
		.insert(divisions)
		.values({
			stageId: weekStageId,
			name: sourceDivision.name,
			description: `Week 1 - ${sourceDivision.level}`,
			level: sourceDivision.level,
			type: sourceDivision.type,
			urlSlug: `week-1-${sourceDivision.level.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		})
		.returning()

	return created
}

async function run() {
	const competition = await getCompetitionOrThrow()
	const registrationStage = await getRegistrationStageOrThrow(
		competition.id,
		competition.registrationStageId,
	)

	const week1Stage = await getOrCreateWeek1Stage(competition.id)

	const registrationDivisions = await db.query.divisions.findMany({
		where: eq(divisions.stageId, registrationStage.id),
		with: {
			teams: {
				orderBy: (team, { asc }) => [asc(team.id)],
			},
		},
	})

	let totalGames = 0
	let totalGameSets = 0

	for (const assignment of WEEK_1_ASSIGNMENTS) {
		const sourceDivision = registrationDivisions.find((d) => d.level === assignment.divisionLevel)

		if (!sourceDivision) {
			throw new Error(`Registration division not found: ${assignment.divisionLevel}`)
		}

		const scheduledDivision = await getOrCreateWeekDivision(week1Stage.id, {
			name: sourceDivision.name,
			level: sourceDivision.level,
			type: sourceDivision.type,
		})

		// Re-generate this division schedule idempotently.
		await db.delete(games).where(eq(games.divisionId, scheduledDivision.id))

		const divisionForScheduling: DivisionForScheduling = {
			id: scheduledDivision.id,
			name: scheduledDivision.name,
			teams: sourceDivision.teams.map((team) => ({ id: team.id, name: team.name })),
		}

		const scheduledGames = generateRoundRobinSchedule(
			divisionForScheduling,
			assignment.date,
			START_TIME,
			END_TIME,
			SETUP_WARMUP_MINUTES,
			INTERMISSION_MINUTES,
			CLOSEDOWN_MINUTES,
		)

		const court = await getCourtOrThrow(assignment.venueName, assignment.courtName)

		for (const fixture of scheduledGames) {
			const [game] = await db
				.insert(games)
				.values({
					divisionId: scheduledDivision.id,
					teamAId: fixture.teamA.id,
					teamBId: fixture.teamB.id,
					name: `${scheduledDivision.level} - ${fixture.teamA.name} vs ${fixture.teamB.name}`,
					description: `Week 1 fixture at ${assignment.venueName} / ${assignment.courtName}`,
					startTime: toDateTime(fixture.date, fixture.startTime),
					endTime: toDateTime(fixture.date, fixture.endTime),
				})
				.returning()

			await db.insert(gameSets).values({
				gameId: game.id,
				courtId: court.id,
				name: 'Set 1',
				description: 'Week 1 scheduled match slot',
				startTime: toDateTime(fixture.date, fixture.startTime),
				endTime: toDateTime(fixture.date, fixture.endTime),
			})

			totalGames += 1
			totalGameSets += 1
		}
	}

	console.log(
		`Generated Week 1 stage for ${competition.urlSlug}: games=${totalGames}, gameSets=${totalGameSets}`,
	)
}

await run()
