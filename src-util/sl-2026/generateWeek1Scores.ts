import { and, eq } from 'drizzle-orm'

import scoresData from '../../data/spring-league-w1-scores.json'
import { db } from '../../src/db/client'
import { competitions, divisions, stages } from '../../src/schema'
import {
	applyGameSetScoreAndUpdateStandings,
	recalculateStandingsForStage,
} from '../../src/domain/scorer'

type ScoreEntry = {
	teamA: string
	teamB: string
	scoreTeamA: number
	scoreTeamB: number
	division: string | number
}

type ScoresFileV2 = {
	weekStageSlug?: string
	matches: ScoreEntry[]
}

const COMPETITION_SLUG = 'spring-league-2026'
const WEEK_STAGE_SLUG = 'week-1'

function normalizeTeamName(name: string): string {
	return name.toLowerCase().trim()
}

function doesTeamNameMatch(teamName: string, searchPattern: string): boolean {
	const normalized = normalizeTeamName(teamName)
	const pattern = normalizeTeamName(searchPattern)
	return normalized.startsWith(pattern)
}

function normalizeDivisionLevel(division: string | number | undefined): string | null {
	if (division === undefined || division === null) {
		return null
	}

	if (typeof division === 'number') {
		return `div ${division}`
	}

	const value = division.trim().toLowerCase()
	if (value === '') {
		return null
	}

	if (/^\d+$/.test(value)) {
		return `div ${value}`
	}

	if (value.startsWith('division ')) {
		return value.replace('division ', 'div ').trim()
	}

	return value
}

function toScoreEntry(raw: {
	division: string | number
	teamA: string
	teamB: string
	scoreTeamA: number
	scoreTeamB: number
}): ScoreEntry {
	const scoreTeamA = raw.scoreTeamA
	const scoreTeamB = raw.scoreTeamB

	if (
		typeof raw.teamA !== 'string' ||
		typeof raw.teamB !== 'string' ||
		typeof scoreTeamA !== 'number' ||
		typeof scoreTeamB !== 'number'
	) {
		throw new Error('Invalid score entry in JSON file.')
	}

	if (!Number.isInteger(scoreTeamA) || !Number.isInteger(scoreTeamB)) {
		throw new Error('Scores must be integers in JSON file.')
	}

	if (raw.division === null || String(raw.division).trim() === '') {
		throw new Error(`Division is required for game ${raw.teamA} vs ${raw.teamB}.`)
	}

	return {
		division: raw.division,
		teamA: raw.teamA,
		teamB: raw.teamB,
		scoreTeamA,
		scoreTeamB,
	}
}

function normalizeRawScoresData(raw: unknown): { stageSlug: string; entries: ScoreEntry[] } {
	const defaultStageSlug = WEEK_STAGE_SLUG

	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('scores JSON must be an object with a matches array.')
	}

	const obj = raw as Partial<ScoresFileV2>
	if (!Array.isArray(obj.matches)) {
		throw new Error('scores JSON must include a matches array.')
	}

	if (obj.matches.length === 0) {
		return { stageSlug: defaultStageSlug, entries: [] }
	}

	return {
		stageSlug: defaultStageSlug,
		entries: obj.matches.map((entry) => toScoreEntry(entry)),
	}
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

async function findGameSetByTeamNames(
	stageDivisions: Array<{
		level: string
		games: Array<{
			teamAId: number
			teamBId: number
			teamA: { name: string }
			teamB: { name: string }
			gameSets: Array<{ id: number }>
		}>
	}>,
	teamAPattern: string,
	teamBPattern: string,
	divisionFilter?: string | number,
): Promise<{ gameSetId: number; reversed: boolean } | null> {
	const normalizedDivision = normalizeDivisionLevel(divisionFilter)

	const divisionsToSearch = normalizedDivision
		? stageDivisions.filter(
				(division) => normalizeDivisionLevel(division.level) === normalizedDivision,
			)
		: stageDivisions

	for (const division of divisionsToSearch) {
		for (const game of division.games) {
			const teamAMatches = doesTeamNameMatch(game.teamA.name, teamAPattern)
			const teamBMatches = doesTeamNameMatch(game.teamB.name, teamBPattern)
			const teamAMatchesReversed = doesTeamNameMatch(game.teamA.name, teamBPattern)
			const teamBMatchesReversed = doesTeamNameMatch(game.teamB.name, teamAPattern)

			if (teamAMatches && teamBMatches && game.gameSets.length > 0) {
				return {
					gameSetId: game.gameSets[0].id,
					reversed: false,
				}
			}

			if (teamAMatchesReversed && teamBMatchesReversed && game.gameSets.length > 0) {
				return {
					gameSetId: game.gameSets[0].id,
					reversed: true,
				}
			}
		}
	}

	return null
}

async function run() {
	const parsed = normalizeRawScoresData(scoresData as unknown)
	const data = parsed.entries

	if (data.length === 0) {
		console.log('No scores to process.')
		return
	}

	const competition = await getCompetitionOrThrow()
	const stageSlug = parsed.stageSlug
	const stage = await db.query.stages.findFirst({
		where: and(eq(stages.competitionId, competition.id), eq(stages.urlSlug, stageSlug)),
	})

	if (!stage) {
		throw new Error(`Stage ${stageSlug} not found for competition ${COMPETITION_SLUG}.`)
	}
	const stageDivisions = await db.query.divisions.findMany({
		where: eq(divisions.stageId, stage.id),
		with: {
			games: {
				with: {
					teamA: true,
					teamB: true,
					gameSets: {
						columns: { id: true },
					},
				},
			},
		},
	})

	let processedCount = 0
	let errorCount = 0

	for (const entry of data) {
		try {
			const result = await findGameSetByTeamNames(
				stageDivisions,
				entry.teamA,
				entry.teamB,
				entry.division,
			)

			if (!result) {
				console.warn(
					`No game set found for ${entry.teamA} vs ${entry.teamB}${entry.division !== undefined ? ` (division ${entry.division})` : ''}`,
				)
				errorCount += 1
				continue
			}

			const scoreTeamA = result.reversed ? entry.scoreTeamB : entry.scoreTeamA
			const scoreTeamB = result.reversed ? entry.scoreTeamA : entry.scoreTeamB

			await applyGameSetScoreAndUpdateStandings({
				gameSetId: result.gameSetId,
				scoreTeamA,
				scoreTeamB,
			})

			console.log(
				`✓ Registered score for ${entry.teamA} (${entry.scoreTeamA}) vs ${entry.teamB} (${entry.scoreTeamB})`,
			)
			processedCount += 1
		} catch (error) {
			console.error(
				`Error processing score for ${entry.teamA} vs ${entry.teamB}:`,
				error instanceof Error ? error.message : error,
			)
			errorCount += 1
		}
	}

	await recalculateStandingsForStage(stage.id)
	console.log(`Standings recalculated for stage ${stage.urlSlug}.`)

	console.log(
		`Week 1 scores: processed=${processedCount}, errors=${errorCount}, total=${data.length}`,
	)
}

await run()
