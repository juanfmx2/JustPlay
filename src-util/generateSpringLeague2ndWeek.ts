
import { and, eq } from 'drizzle-orm'

import {
	type DivisionForScheduling,
	type ScheduledGame,
	generateRoundRobinSchedule,
} from '../src/domain/scheduler'
import { db } from '../src/db/client'
import { competitions, stages } from '../src/schema/competition'
import { divisions } from '../src/schema/division'
import { games, gameSets } from '../src/schema/game'
import { standings } from '../src/schema/standings'
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

const TEAM_DIVISION_OVERRIDES = [
	{ teamName: 'Cambridge Blues', targetDivisionLevel: 'Div 2' },
	{ teamName: 'Net Ninjas', targetDivisionLevel: 'Div 1' },
	{ teamName: 'Hit and Miss', targetDivisionLevel: 'Div 3' },
	{ teamName: 'MSG', targetDivisionLevel: 'Div 2' },
	{ teamName: "Andrew's Minions", targetDivisionLevel: 'Div 4' },
	{ teamName: "My digs don't lie", targetDivisionLevel: 'Div 3' },
] as const

const WEEK_2_ASSIGNMENTS: DivisionCourtAssignment[] = [
	{
		divisionLevel: 'Div 1',
		date: '2026-04-30',
		venueName: 'North Cambridge Academy (NCA)',
		courtName: 'Sports Hall',
	},
	{
		divisionLevel: 'Div 2',
		date: '2026-05-01',
		venueName: 'North Cambridge Academy (NCA)',
		courtName: 'Sports Hall',
	},
	{
		divisionLevel: 'Div 3',
		date: '2026-05-01',
		venueName: 'The Perse',
		courtName: 'Sports Hall A',
	},
	{
		divisionLevel: 'Div 4',
		date: '2026-05-01',
		venueName: 'The Perse',
		courtName: 'Sports Hall B',
	},
]

function toDateTime(date: string, time: string): Date {
	return new Date(`${date}T${time}:00+01:00`)
}

function assignReffingTeams(
	fixtures: ScheduledGame[],
	teams: Array<{ id: number; name: string }>,
): Array<number | null> {
	if (teams.length < 3) {
		return fixtures.map(() => null)
	}

	const orderedTeams = [...teams].sort((a, b) => a.id - b.id)
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
		throw new Error(`Competition ${COMPETITION_SLUG} not found.`)
	}

	return competition
}

async function getRegistrationStageOrThrow(
	competitionId: number,
	registrationStageId: number | null,
) {
	const stage = registrationStageId
		? await db.query.stages.findFirst({
				where: and(
					eq(stages.id, registrationStageId),
					eq(stages.competitionId, competitionId),
				),
			})
		: await db.query.stages.findFirst({
				where: and(
					eq(stages.competitionId, competitionId),
					eq(stages.type, 'REGISTRATION'),
				),
			})

	if (!stage) {
		throw new Error('Registration stage not found for Spring League 2026.')
	}

	return stage
}

async function getOrCreateWeek2Stage(competitionId: number) {
	const existing = await db.query.stages.findFirst({
		where: and(eq(stages.competitionId, competitionId), eq(stages.urlSlug, 'week-2')),
	})

	if (existing) {
		return existing
	}

	const [created] = await db
		.insert(stages)
		.values({
			competitionId,
			name: 'Week 2',
			description: 'Spring League 2026 - Week 2 fixtures',
			urlSlug: 'week-2',
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

async function getOrCreateWeekDivision(
	weekStageId: number,
	sourceDivision: { name: string; level: string; type: 'MEN' | 'WOMEN' | 'MIXED' },
) {
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
			description: `Week 2 - ${sourceDivision.level}`,
			level: sourceDivision.level,
			type: sourceDivision.type,
			urlSlug: `${sourceDivision.level.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		})
		.returning()

	return created
}

function buildWeek2TeamsByDivision(
	registrationDivisions: Array<{
		id: number
		level: string
		teams: Array<{ id: number; name: string }>
	}>,
) {
	const teamsByDivision = new Map<string, Array<{ id: number; name: string }>>(
		registrationDivisions.map((division) => [
			division.level,
			division.teams.map((team) => ({ id: team.id, name: team.name })),
		]),
	)

	for (const move of TEAM_DIVISION_OVERRIDES) {
		let sourceDivisionLevel: string | null = null

		for (const [divisionLevel, teams] of teamsByDivision.entries()) {
			if (teams.some((team) => team.name === move.teamName)) {
				sourceDivisionLevel = divisionLevel
				break
			}
		}

		if (!sourceDivisionLevel) {
			throw new Error(`Team not found in current divisions: ${move.teamName}`)
		}

		if (sourceDivisionLevel === move.targetDivisionLevel) {
			continue
		}

		const sourceTeams = teamsByDivision.get(sourceDivisionLevel)
		const targetTeams = teamsByDivision.get(move.targetDivisionLevel)

		if (!sourceTeams || !targetTeams) {
			throw new Error(
				`Invalid division move for ${move.teamName}: ${sourceDivisionLevel} -> ${move.targetDivisionLevel}`,
			)
		}

		const teamIndex = sourceTeams.findIndex((team) => team.name === move.teamName)
		if (teamIndex < 0) {
			throw new Error(`Team not found in source division: ${move.teamName}`)
		}

		const [team] = sourceTeams.splice(teamIndex, 1)
		targetTeams.push(team)
	}

	for (const [divisionLevel, teams] of teamsByDivision.entries()) {
		const uniqueIds = new Set(teams.map((team) => team.id))
		if (uniqueIds.size !== teams.length) {
			throw new Error(`Duplicate team assignment detected in ${divisionLevel}`)
		}
	}

	return teamsByDivision
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

	const week2Stage = await getOrCreateWeek2Stage(competition.id)

	const registrationDivisions = await db.query.divisions.findMany({
		where: eq(divisions.stageId, registrationStage.id),
		with: {
			teams: {
				orderBy: (team, { asc }) => [asc(team.id)],
			},
		},
	})

	const week2TeamsByDivision = buildWeek2TeamsByDivision(registrationDivisions)

	let totalGames = 0
	let totalGameSets = 0

	for (const assignment of WEEK_2_ASSIGNMENTS) {
		const sourceDivision = registrationDivisions.find(
			(d) => d.level === assignment.divisionLevel,
		)

		if (!sourceDivision) {
			throw new Error(`Registration division not found: ${assignment.divisionLevel}`)
		}

		const divisionTeams = week2TeamsByDivision.get(assignment.divisionLevel)
		if (!divisionTeams || divisionTeams.length < 2) {
			throw new Error(`Not enough teams in ${assignment.divisionLevel} for Week 2 scheduling.`)
		}

		const scheduledDivision = await getOrCreateWeekDivision(week2Stage.id, {
			name: sourceDivision.name,
			level: sourceDivision.level,
			type: sourceDivision.type,
		})

		// Re-generate this division schedule idempotently.
		await db.delete(games).where(eq(games.divisionId, scheduledDivision.id))

		const divisionForScheduling: DivisionForScheduling = {
			id: scheduledDivision.id,
			name: scheduledDivision.name,
			teams: divisionTeams.map((team) => ({ id: team.id, name: team.name })),
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

		const reffingTeamIds = assignReffingTeams(
			scheduledGames,
			divisionForScheduling.teams,
		)

		const court = await getCourtOrThrow(assignment.venueName, assignment.courtName)

		for (const [index, fixture] of scheduledGames.entries()) {
			const [game] = await db
				.insert(games)
				.values({
					divisionId: scheduledDivision.id,
					teamAId: fixture.teamA.id,
					teamBId: fixture.teamB.id,
					reffingTeamId: reffingTeamIds[index],
					name: `${scheduledDivision.level} - ${fixture.teamA.name} vs ${fixture.teamB.name}`,
					description: `Week 2 fixture at ${assignment.venueName} / ${assignment.courtName}`,
					startTime: toDateTime(fixture.date, fixture.startTime),
					endTime: toDateTime(fixture.date, fixture.endTime),
				})
				.returning()

			await db.insert(gameSets).values({
				gameId: game.id,
				courtId: court.id,
				name: 'Set 1',
				description: 'Week 2 scheduled match slot',
				startTime: toDateTime(fixture.date, fixture.startTime),
				endTime: toDateTime(fixture.date, fixture.endTime),
			})

			totalGames += 1
			totalGameSets += 1
		}
	}

	const totalStandings = await regenerateStandingsForCompetition(competition.id)

	console.log(
		`Generated Week 2 stage for ${competition.urlSlug}: games=${totalGames}, gameSets=${totalGameSets}, standings=${totalStandings}`,
	)
}

await run()
