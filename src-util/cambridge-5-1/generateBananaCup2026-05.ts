import { and, eq } from 'drizzle-orm'

import {
	type DivisionForScheduling,
	type ScheduledGame,
	generateRoundRobinSchedule,
} from '../../src/domain/scheduler'
import { db } from '../../src/db/client'
import { competitions, stages } from '../../src/schema/competition'
import { divisions } from '../../src/schema/division'
import { games, gameSets } from '../../src/schema/game'
import { standings } from '../../src/schema/standings'
import { courts, venues } from '../../src/schema/venue'

const COMPETITION_SLUG = 'banana-cup'
const VENUE_NAME = 'North Cambridge Academy (NCA)'
const COURT_NAME = 'Sports Hall'

type EventConfig = {
	date: string
	stageSlug: string
	stageName: string
	stageDescription: string
	gameDescription: string
	rounds: Array<{ startTime: string; endTime: string }>
}

const EVENTS: EventConfig[] = [
	{
		date: '2026-05-24',
		stageSlug: 'banana-cup-2026-05',
		stageName: 'Banana Cup – May 2026',
		stageDescription: 'Banana Cup event – 3× round-robin',
		gameDescription: 'Banana Cup 24th of May 2026',
		rounds: [
			{ startTime: '12:15', endTime: '13:08' },
			{ startTime: '13:10', endTime: '14:03' },
			{ startTime: '14:05', endTime: '14:57' },
		],
	},
	{
		date: '2026-07-05',
		stageSlug: 'banana-cup-2026-07-05',
		stageName: 'Banana Cup – July 5 2026',
		stageDescription: 'Banana Cup event – 3× round-robin (10:30-14:00)',
		gameDescription: 'Banana Cup 5th of July 2026',
		// Hosted 10:30-14:00 with the first game at 10:45.
		rounds: [
			{ startTime: '10:45', endTime: '11:48' },
			{ startTime: '11:50', endTime: '12:53' },
			{ startTime: '12:55', endTime: '14:00' },
		],
	},
]

const SETUP_WARMUP_MINUTES = 0
const INTERMISSION_MINUTES = 2
const CLOSEDOWN_MINUTES = 0

function toDateTime(date: string, time: string): Date {
	return new Date(`${date}T${time}:00+01:00`)
}

function assignReffingTeams(
	fixtures: ScheduledGame[],
	divisionTeams: Array<{ id: number; name: string }>,
): Array<number | null> {
	if (divisionTeams.length < 3) {
		return fixtures.map(() => null)
	}

	const orderedTeams = [...divisionTeams].sort((a, b) => a.id - b.id)
	const assignedCounts = new Map<number, number>(
		orderedTeams.map((team) => [team.id, 0]),
	)
	let rotationCursor = 0

	return fixtures.map((fixture) => {
		const eligibleTeams = orderedTeams.filter(
			(team) => team.id !== fixture.teamA.id && team.id !== fixture.teamB.id,
		)

		if (eligibleTeams.length === 0) {
			return null
		}

		const minAssigned = Math.min(
			...eligibleTeams.map((team) => assignedCounts.get(team.id) ?? 0),
		)
		const balancedCandidates = eligibleTeams.filter(
			(team) => (assignedCounts.get(team.id) ?? 0) === minAssigned,
		)

		let selectedTeam = balancedCandidates[0]

		for (let step = 0; step < orderedTeams.length; step += 1) {
			const candidateIndex = (rotationCursor + step) % orderedTeams.length
			const candidate = orderedTeams[candidateIndex]
			if (balancedCandidates.some((team) => team.id === candidate.id)) {
				selectedTeam = candidate
				rotationCursor = (candidateIndex + 1) % orderedTeams.length
				break
			}
		}

		assignedCounts.set(
			selectedTeam.id,
			(assignedCounts.get(selectedTeam.id) ?? 0) + 1,
		)

		return selectedTeam.id
	})
}

async function getCompetitionOrThrow() {
	const competition = await db.query.competitions.findFirst({
		where: eq(competitions.urlSlug, COMPETITION_SLUG),
	})

	if (!competition) {
		throw new Error(`Competition ${COMPETITION_SLUG} not found. Run generateRegistration.ts first.`)
	}

	return competition
}

async function getOrCreateEventStage(competitionId: number, event: EventConfig) {
	const existing = await db.query.stages.findFirst({
		where: and(eq(stages.competitionId, competitionId), eq(stages.urlSlug, event.stageSlug)),
	})

	if (existing) {
		return existing
	}

	const [created] = await db
		.insert(stages)
		.values({
			competitionId,
			name: event.stageName,
			description: event.stageDescription,
			urlSlug: event.stageSlug,
			type: 'PLAY',
		})
		.returning()

	return created
}

async function getOrCreateEventDivision(
	stageId: number,
	sourceDivision: { name: string; level: string; type: 'MEN' | 'WOMEN' | 'MIXED' },
) {
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
			description: `Banana Cup – ${sourceDivision.level}`,
			level: sourceDivision.level,
			type: sourceDivision.type,
			urlSlug: sourceDivision.level.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
		})
		.returning()

	return created
}

async function getCourtOrThrow() {
	const venue = await db.query.venues.findFirst({
		where: eq(venues.name, VENUE_NAME),
	})

	if (!venue) {
		throw new Error(`Venue not found: ${VENUE_NAME}`)
	}

	const court = await db.query.courts.findFirst({
		where: and(eq(courts.venueId, venue.id), eq(courts.name, COURT_NAME)),
	})

	if (!court) {
		throw new Error(`Court not found: ${VENUE_NAME} / ${COURT_NAME}`)
	}

	return court
}

async function regenerateStandingsForStage(stageId: number) {
	const stage = await db.query.stages.findFirst({
		where: eq(stages.id, stageId),
		with: {
			divisions: {
				with: {
					teams: { columns: { id: true } },
					games: { columns: { teamAId: true, teamBId: true } },
				},
			},
		},
	})

	if (!stage) {
		throw new Error(`Stage not found for standings regeneration: ${stageId}`)
	}

	let standingsRows = 0

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

	return standingsRows
}

async function run() {
	const competition = await getCompetitionOrThrow()
	const registrationStage = competition.registrationStageId
		? await db.query.stages.findFirst({ where: eq(stages.id, competition.registrationStageId) })
		: await db.query.stages.findFirst({
				where: and(eq(stages.competitionId, competition.id), eq(stages.type, 'REGISTRATION')),
			})

	if (!registrationStage) {
		throw new Error('Registration stage not found for Banana Cup.')
	}

	const registrationDivisions = await db.query.divisions.findMany({
		where: eq(divisions.stageId, registrationStage.id),
		with: {
			teams: { orderBy: (team, { asc }) => [asc(team.id)] },
		},
	})

	if (registrationDivisions.length === 0) {
		throw new Error('No divisions found in the registration stage. Run generateRegistration.ts first.')
	}

	const court = await getCourtOrThrow()

	let totalGames = 0
	let totalGameSets = 0
	let totalStandings = 0

    const eventDivisions = [
        { name: 'Division 1', level: 'div 1'}
    ]

    const baseDiv = registrationDivisions[0]

	for (const event of EVENTS) {
		const eventStage = await getOrCreateEventStage(competition.id, event)

		for (const sourceDivision of eventDivisions) {
			const scheduledDivision = await getOrCreateEventDivision(eventStage.id, {
				name: sourceDivision.name,
				level: sourceDivision.level,
				type: baseDiv.type,
			})

			// Idempotent: clear previously generated games for this division.
			await db.delete(games).where(eq(games.divisionId, scheduledDivision.id))

			const divisionTeams = baseDiv.teams.map((team) => ({ id: team.id, name: team.name }))

			const allScheduledGames: ScheduledGame[] = []

			const teamC = divisionTeams.pop()
			divisionTeams.splice(0, 0, teamC!)
			console.log('TEAMS FOR SCHEDULING:')
			console.log(divisionTeams.map((t) => t.name).join(', '))
			// Generate 3 consecutive round-robins, each within its own time window.
			for (const [roundIndex, round] of event.rounds.entries()) {
				const divisionForScheduling: DivisionForScheduling = {
					// Use a virtual ID per round so internal game IDs don't collide.
					id: scheduledDivision.id * 10 + roundIndex,
					name: `${scheduledDivision.name} – Round ${roundIndex + 1}`,
					teams: divisionTeams,
				}

				const roundGames = generateRoundRobinSchedule(
					divisionForScheduling,
					event.date,
					round.startTime,
					round.endTime,
					SETUP_WARMUP_MINUTES,
					INTERMISSION_MINUTES,
					CLOSEDOWN_MINUTES,
				)

				allScheduledGames.push(...roundGames)
			}

			const reffingTeamIds = assignReffingTeams(allScheduledGames, divisionTeams)

			for (const [index, fixture] of allScheduledGames.entries()) {
				const [game] = await db
					.insert(games)
					.values({
						divisionId: scheduledDivision.id,
						teamAId: fixture.teamA.id,
						teamBId: fixture.teamB.id,
						reffingTeamId: reffingTeamIds[index],
						name: `${scheduledDivision.level} – ${fixture.teamA.name} vs ${fixture.teamB.name}`,
						description: `${event.gameDescription} – ${VENUE_NAME} / ${COURT_NAME}`,
						startTime: toDateTime(fixture.date, fixture.startTime),
						endTime: toDateTime(fixture.date, fixture.endTime),
					})
					.returning()

				await db.insert(gameSets).values({
					gameId: game.id,
					courtId: court.id,
					name: 'Set 1',
					description: `${event.gameDescription} – scheduled match slot`,
					startTime: toDateTime(fixture.date, fixture.startTime),
					endTime: toDateTime(fixture.date, fixture.endTime),
				})

				totalGames += 1
				totalGameSets += 1
			}
		}

		totalStandings += await regenerateStandingsForStage(eventStage.id)
	}

	console.log(
		`Generated Banana Cup event stage for ${competition.urlSlug}: games=${totalGames}, gameSets=${totalGameSets}, standings=${totalStandings}`,
	)
}

await run()
