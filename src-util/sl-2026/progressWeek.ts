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
import { organizations } from '../../src/schema/organization'
import { standings } from '../../src/schema/standings'
import { teams } from '../../src/schema/team'
import { courts, venues } from '../../src/schema/venue'

const START_TIME = '18:00'
const END_TIME = '22:00'
const SETUP_WARMUP_MINUTES = 14
const INTERMISSION_MINUTES = 4
const CLOSEDOWN_MINUTES = 2
const NEXT_WEEK_OFFSET_DAYS = 7

type ProgressWeekInput = {
	organizationSlug: string
	competitionSlug: string
	currentWeekStageSlug: string
}

type TeamRef = {
	id: number
	name: string
}

type DivisionAssignment = {
	date: string
	venueName: string
	courtName: string
}

function toDateTime(date: string, time: string): Date {
	return new Date(`${date}T${time}:00+01:00`)
}

function addDaysToDate(date: Date, daysToAdd: number): Date {
	const copy = new Date(date)
	copy.setDate(copy.getDate() + daysToAdd)
	return copy
}

function toIsoDate(date: Date): string {
	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	return `${year}-${month}-${day}`
}

function parseDivisionLevel(level: string): number {
	const numeric = Number.parseInt(level.replace(/[^0-9]/g, ''), 10)
	if (Number.isNaN(numeric)) {
		throw new Error(`Could not parse division level from "${level}"`)
	}
	return numeric
}

function parseWeekNumberOrThrow(weekStageSlug: string): number {
	const match = /^week-(\d+)$/i.exec(weekStageSlug.trim())
	if (!match) {
		throw new Error(`Invalid week stage slug: ${weekStageSlug}. Expected format week-N.`)
	}

	const weekNumber = Number.parseInt(match[1], 10)
	if (!Number.isFinite(weekNumber) || weekNumber < 1) {
		throw new Error(`Invalid week number in slug: ${weekStageSlug}`)
	}

	return weekNumber
}

function coefficientToNumber(value: string | null): number {
	if (!value) return Number.NEGATIVE_INFINITY
	const parsed = Number.parseFloat(value)
	return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

function assignReffingTeams(
	fixtures: ScheduledGame[],
	divisionTeams: TeamRef[],
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

async function getOrCreateWeekStage(
	competitionId: number,
	weekNumber: number,
) {
	const weekSlug = `week-${weekNumber}`
	const existing = await db.query.stages.findFirst({
		where: and(eq(stages.competitionId, competitionId), eq(stages.urlSlug, weekSlug)),
	})

	if (existing) {
		return existing
	}

	const [created] = await db
		.insert(stages)
		.values({
			competitionId,
			name: `Week ${weekNumber}`,
			description: `Spring League fixtures - Week ${weekNumber}`,
			urlSlug: weekSlug,
			type: 'PLAY',
		})
		.returning()

	return created
}

async function getOrCreateWeekDivision(
	weekStageId: number,
	sourceDivision: { name: string; level: string; type: 'MEN' | 'WOMEN' | 'MIXED' },
	weekNumber: number,
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
			description: `Week ${weekNumber} - ${sourceDivision.level}`,
			level: sourceDivision.level,
			type: sourceDivision.type,
			urlSlug: `${sourceDivision.level.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		})
		.returning()

	return created
}

async function regenerateStandingsForStage(stageId: number) {
	const stage = await db.query.stages.findFirst({
		where: eq(stages.id, stageId),
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

export async function progressWeek(input: ProgressWeekInput) {
	const organization = await db.query.organizations.findFirst({
		where: eq(organizations.urlSlug, input.organizationSlug),
	})

	if (!organization) {
		throw new Error(`Organization not found: ${input.organizationSlug}`)
	}

	const competition = await db.query.competitions.findFirst({
		where: and(
			eq(competitions.organizationId, organization.id),
			eq(competitions.urlSlug, input.competitionSlug),
		),
	})

	if (!competition) {
		throw new Error(
			`Competition not found for org=${input.organizationSlug} slug=${input.competitionSlug}`,
		)
	}

	const currentWeekStage = await db.query.stages.findFirst({
		where: and(
			eq(stages.competitionId, competition.id),
			eq(stages.urlSlug, input.currentWeekStageSlug),
		),
		with: {
			divisions: {
				with: {
					games: {
						orderBy: (game, { asc }) => [asc(game.startTime)],
						with: {
							gameSets: {
								orderBy: (set, { asc }) => [asc(set.startTime)],
								with: {
									court: {
										with: { venue: true },
									},
								},
							},
						},
					},
				},
				orderBy: (division, { asc }) => [asc(division.level)],
			},
		},
	})

	if (!currentWeekStage) {
		throw new Error(`Current week stage not found: ${input.currentWeekStageSlug}`)
	}

	if (currentWeekStage.divisions.length === 0) {
		throw new Error(`Current stage has no divisions: ${input.currentWeekStageSlug}`)
	}

	const currentWeekNumber = parseWeekNumberOrThrow(input.currentWeekStageSlug)
	const nextWeekNumber = currentWeekNumber + 1
	const nextWeekStage = await getOrCreateWeekStage(competition.id, nextWeekNumber)

	const rankedTeamsByLevel = new Map<number, TeamRef[]>()
	const sourceDivisionByLevel = new Map<number, (typeof currentWeekStage.divisions)[number]>()
	const assignmentByLevel = new Map<number, DivisionAssignment>()

	for (const division of currentWeekStage.divisions) {
		const levelNumber = parseDivisionLevel(division.level)
		sourceDivisionByLevel.set(levelNumber, division)

		const standingsRows = await db.query.standings.findMany({
			where: and(
				eq(standings.stageId, currentWeekStage.id),
				eq(standings.divisionId, division.id),
			),
			with: {
				team: {
					columns: {
						id: true,
						name: true,
					},
				},
			},
		})

		const rankedTeams = standingsRows
			.sort((a, b) => {
				const gwA = a.gamesWon ?? 0
				const gwB = b.gamesWon ?? 0
				if (gwA !== gwB) {
					return gwB - gwA
				}

				return coefficientToNumber(b.coefficient) - coefficientToNumber(a.coefficient)
			})
			.map((row) => ({ id: row.team.id, name: row.team.name }))

		if (rankedTeams.length < 2) {
			throw new Error(
				`Division ${division.level} has fewer than 2 ranked teams; cannot progress week.`,
			)
		}

		rankedTeamsByLevel.set(levelNumber, rankedTeams)

		const firstGameWithCourt = division.games.find(
			(game) => game.gameSets.length > 0 && game.gameSets[0].court?.venue?.name,
		)

		if (!firstGameWithCourt || !firstGameWithCourt.startTime) {
			throw new Error(
				`Could not derive venue/court assignment for ${division.level} from ${input.currentWeekStageSlug}.`,
			)
		}

		const firstSet = firstGameWithCourt.gameSets[0]
		const nextDate = toIsoDate(addDaysToDate(firstGameWithCourt.startTime, NEXT_WEEK_OFFSET_DAYS))
		assignmentByLevel.set(levelNumber, {
			date: nextDate,
			venueName: firstSet.court.venue!.name,
			courtName: firstSet.court.name,
		})
	}

	const levels = Array.from(rankedTeamsByLevel.keys()).sort((a, b) => a - b)
	const promotedByLevel = new Map<number, TeamRef>()
	const demotedByLevel = new Map<number, TeamRef>()

	for (let i = 0; i < levels.length; i += 1) {
		const level = levels[i]
		const divisionTeams = rankedTeamsByLevel.get(level)
		if (!divisionTeams) continue

		const hasUpperDivision = i > 0
		const hasLowerDivision = i < levels.length - 1

		if (hasUpperDivision) {
			promotedByLevel.set(level, divisionTeams[0])
		}

		if (hasLowerDivision) {
			demotedByLevel.set(level, divisionTeams[divisionTeams.length - 1])
		}
	}

	const nextTeamsByLevel = new Map<number, TeamRef[]>()

	for (let i = 0; i < levels.length; i += 1) {
		const level = levels[i]
		const divisionTeams = rankedTeamsByLevel.get(level)
		if (!divisionTeams) continue

		const promotedOut = promotedByLevel.get(level)
		const demotedOut = demotedByLevel.get(level)
		const incomingFromUpper = i > 0 ? demotedByLevel.get(levels[i - 1]) : undefined
		const incomingFromLower = i < levels.length - 1 ? promotedByLevel.get(levels[i + 1]) : undefined

		const baseTeams = divisionTeams.filter(
			(team) => team.id !== promotedOut?.id && team.id !== demotedOut?.id,
		)

		const nextDivisionTeams = [
			...baseTeams,
			...(incomingFromUpper ? [incomingFromUpper] : []),
			...(incomingFromLower ? [incomingFromLower] : []),
		]

		const uniqueTeamIds = new Set(nextDivisionTeams.map((team) => team.id))
		if (uniqueTeamIds.size !== nextDivisionTeams.length) {
			throw new Error(`Duplicate team assignment detected after progression in Div ${level}`)
		}

		nextTeamsByLevel.set(level, nextDivisionTeams)
	}

	let totalGames = 0
	let totalGameSets = 0

	for (const level of levels) {
		const sourceDivision = sourceDivisionByLevel.get(level)
		const assignment = assignmentByLevel.get(level)
		const divisionTeams = nextTeamsByLevel.get(level)
		if (!sourceDivision || !assignment || !divisionTeams) {
			throw new Error(`Missing progression data for division level ${level}`)
		}

		if (divisionTeams.length < 2) {
			throw new Error(`Not enough teams in Div ${level} for scheduling the next week.`)
		}

		const scheduledDivision = await getOrCreateWeekDivision(
			nextWeekStage.id,
			{
				name: sourceDivision.name,
				level: sourceDivision.level,
				type: sourceDivision.type,
			},
			nextWeekNumber,
		)

		await db.delete(games).where(eq(games.divisionId, scheduledDivision.id))

		const divisionForScheduling: DivisionForScheduling = {
			id: scheduledDivision.id,
			name: scheduledDivision.name,
			teams: divisionTeams,
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

		const reffingTeamIds = assignReffingTeams(scheduledGames, divisionForScheduling.teams)
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
					description: `Week ${nextWeekNumber} fixture at ${assignment.venueName} / ${assignment.courtName}`,
					startTime: toDateTime(fixture.date, fixture.startTime),
					endTime: toDateTime(fixture.date, fixture.endTime),
				})
				.returning()

			await db.insert(gameSets).values({
				gameId: game.id,
				courtId: court.id,
				name: 'Set 1',
				description: `Week ${nextWeekNumber} scheduled match slot`,
				startTime: toDateTime(fixture.date, fixture.startTime),
				endTime: toDateTime(fixture.date, fixture.endTime),
			})

			totalGames += 1
			totalGameSets += 1
		}
	}

	const totalStandings = await regenerateStandingsForStage(nextWeekStage.id)

	console.log(
		`Progressed ${input.currentWeekStageSlug} -> week-${nextWeekNumber} for ${input.competitionSlug}: games=${totalGames}, gameSets=${totalGameSets}, standings=${totalStandings}`,
	)
}
