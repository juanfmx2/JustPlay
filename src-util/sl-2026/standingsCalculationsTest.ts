import { and, eq } from 'drizzle-orm'

import { db } from '../../src/db/client'
import { competitions, stages } from '../../src/schema/competition'
import type { Division } from '../../src/schema/division'
import type { Stage } from '../../src/schema/competition'
import { organizations } from '../../src/schema/organization'

const ORGANIZATION_SLUG = 'cvc'
const COMPETITION_SLUG = 'spring-league-2026'

type DivisionScoringRules = {
	winnerLeaguePoints: number
	closeLossLeaguePoints: number
	closeLossThreshold: number
}

type StageStandingRow = {
	teamId: number
	teamName: string
	divisionId: number
	divisionName: string
	divisionLevel: string
	gamesWon: number
	gamesLost: number
	pointsFor: number
	pointsAgainst: number
	penalties: number
	leaguePoints: number
	movementLeaguePointsUp: number
	movementLeaguePointsDown: number
	coefficient: string | null
	leaguePointsMinusPenalties: number
}

type TotalStandingRow = {
	teamId: number
	teamName: string
	registrationDivisionId: number
	registrationDivisionName: string
	registrationDivisionLevel: string
	gamesWon: number
	gamesLost: number
	pointsFor: number
	pointsAgainst: number
	penalties: number
	leaguePoints: number
	movementLeaguePointsUp: number
	movementLeaguePointsDown: number
	coefficient: string | null
	leaguePointsMinusPenalties: number
}

type TeamRegistryEntry = {
	teamId: number
	teamName: string
	registrationDivisionId: number
	registrationDivisionName: string
	registrationDivisionLevel: string
}

type StageStandingContext = {
	stage: Pick<Stage, 'id' | 'name' | 'urlSlug'>
	division: Pick<Division, 'id' | 'name' | 'level'>
	rows: StageStandingRow[]
}

type MovementContext = StageStandingContext & {
	row: StageStandingRow
	rankingIndex: number
}

type PenaltyContext = {
	stage: Pick<Stage, 'id' | 'name' | 'urlSlug'>
	division: Pick<Division, 'id' | 'name' | 'level'>
	team: TeamRegistryEntry
	row: Omit<StageStandingRow, 'penalties' | 'movementLeaguePoints' | 'coefficient' | 'leaguePointsMinusPenalties'>
}

type CalculatorHooks = {
	getDivisionScoringRules: (context: {
		stage: Pick<Stage, 'id' | 'name' | 'urlSlug'>
		division: Pick<Division, 'id' | 'name' | 'level'>
	}) => DivisionScoringRules
	getPenaltyPoints: (context: PenaltyContext) => number
	getMovementLeaguePointsUp: (context: MovementContext) => number
	getMovementLeaguePointsDown: (context: MovementContext) => number
	compareStageStandings: (a: StageStandingRow, b: StageStandingRow, context: StageStandingContext) => number
	compareTotalStandings: (a: TotalStandingRow, b: TotalStandingRow) => number
}

const hooks: CalculatorHooks = {
	getDivisionScoringRules: ({ division }) => {
		const normalizedLevel = normalizeDivisionLevel(division.level)

        const numDivsions = 4
        const divNumber = getDivisionNumber(division.level)
        if (divNumber !== null && (divNumber < 1 || divNumber > numDivsions)) {
            throw new Error(`Invalid division level number: ${division.level}`)
        }
        const divPower = divNumber !== null ? numDivsions - divNumber + 1 : 1
        return {
            winnerLeaguePoints: 2*divPower,
            closeLossLeaguePoints: Math.floor(1*divPower),
            closeLossThreshold: 10,
            weeklyBonusPoints: 0,
        }
	},

	getPenaltyPoints: () => 0,

	getMovementLeaguePointsUp: ({ division, rankingIndex, rows }) => {
		const divisionNumber = getDivisionNumber(division.level)
		if (divisionNumber === null || rows.length <= 1) {
			return 0
		}

        const divPower = divisionNumber !== null ? 4 - divisionNumber + 1 : 1

		let adjustment = 0

		if (rankingIndex === 0 && divisionNumber >= 2) {
            
			adjustment += 0
		}

		if (rankingIndex === rows.length - 1 && divisionNumber <= 3) {
			adjustment -= 0
		}

		return adjustment
	},
	getMovementLeaguePointsDown: ({ division, rankingIndex, rows }) => {
		const divisionNumber = getDivisionNumber(division.level)
		if (divisionNumber === null || rows.length <= 1) {
			return 0
		}

        const divPower = divisionNumber !== null ? 4 - divisionNumber + 1 : 1

		let adjustment = 0

		if (rankingIndex === 0 && divisionNumber >= 2) {
            
			adjustment += 0
		}

		if (rankingIndex === rows.length - 1 && divisionNumber <= 3) {
			adjustment -= 0
		}

		return adjustment
	},

	compareStageStandings: (a, b) => compareStageStandingRows(a, b),

	compareTotalStandings: (a, b) => compareTotalStandingRows(a, b),
}

function normalizeDivisionLevel(level: string): string {
	return level.trim().toLowerCase()
}

function getDivisionNumber(level: string): number | null {
	const match = normalizeDivisionLevel(level).match(/\d+/)
	return match ? Number(match[0]) : null
}

function computeCoefficient(pointsFor: number, pointsAgainst: number): string | null {
	if (pointsAgainst === 0) {
		return null
	}

	return (pointsFor / pointsAgainst).toFixed(4)
}

function asSortableCoefficient(value: string | null): number {
	return value === null ? Number.NEGATIVE_INFINITY : Number(value)
}

function compareStageStandingRows(a: StageStandingRow, b: StageStandingRow): number {
	if (b.gamesWon !== a.gamesWon) {
		return b.gamesWon - a.gamesWon
	}

	const coefficientDiff = asSortableCoefficient(b.coefficient) - asSortableCoefficient(a.coefficient)
	if (coefficientDiff !== 0) {
		return coefficientDiff
	}

	return a.teamName.localeCompare(b.teamName)
}

function compareTotalStandingRows(a: TotalStandingRow, b: TotalStandingRow): number {
	if (b.leaguePointsMinusPenalties !== a.leaguePointsMinusPenalties) {
		return b.leaguePointsMinusPenalties - a.leaguePointsMinusPenalties
	}

	if (b.gamesWon !== a.gamesWon) {
		return b.gamesWon - a.gamesWon
	}

	const coefficientDiff = asSortableCoefficient(b.coefficient) - asSortableCoefficient(a.coefficient)
	if (coefficientDiff !== 0) {
		return coefficientDiff
	}

	return a.teamName.localeCompare(b.teamName)
}

function createEmptyStageStandingRow(team: TeamRegistryEntry, division: Pick<Division, 'id' | 'name' | 'level'>): StageStandingRow {
	return {
		teamId: team.teamId,
		teamName: team.teamName,
		divisionId: division.id,
		divisionName: division.name,
		divisionLevel: division.level,
		gamesWon: 0,
		gamesLost: 0,
		pointsFor: 0,
		pointsAgainst: 0,
		penalties: 0,
		leaguePoints: 0,
		movementLeaguePointsUp: 0,
        movementLeaguePointsDown: 0,
		coefficient: null,
		leaguePointsMinusPenalties: 0,
	}
}

function applyGameResult(
	row: StageStandingRow,
	teamScore: number,
	opponentScore: number,
	scoringRules: DivisionScoringRules,
): void {
	row.pointsFor += teamScore
	row.pointsAgainst += opponentScore

	if (teamScore > opponentScore) {
		row.gamesWon += 1
		row.leaguePoints += scoringRules.winnerLeaguePoints
		return
	}

	if (teamScore < opponentScore) {
		row.gamesLost += 1
		if (opponentScore - teamScore <= scoringRules.closeLossThreshold) {
			row.leaguePoints += scoringRules.closeLossLeaguePoints
		}
	}
}

async function loadCompetitionContext() {
	const organization = await db.query.organizations.findFirst({
		where: eq(organizations.urlSlug, ORGANIZATION_SLUG),
	})

	if (!organization) {
		throw new Error(`Organization not found: ${ORGANIZATION_SLUG}`)
	}

	const competition = await db.query.competitions.findFirst({
		where: and(
			eq(competitions.organizationId, organization.id),
			eq(competitions.urlSlug, COMPETITION_SLUG),
		),
	})

	if (!competition) {
		throw new Error(`Competition not found: ${COMPETITION_SLUG}`)
	}

	if (!competition.registrationStageId) {
		throw new Error(`Competition ${COMPETITION_SLUG} has no registration stage configured.`)
	}

	const registrationStage = await db.query.stages.findFirst({
		where: and(
			eq(stages.id, competition.registrationStageId),
			eq(stages.competitionId, competition.id),
		),
		with: {
			divisions: {
				with: {
					teams: {
						columns: {
							id: true,
							name: true,
						},
					},
				},
			},
		},
	})

	if (!registrationStage) {
		throw new Error(`Registration stage not found for ${COMPETITION_SLUG}`)
	}

	const playStages = await db.query.stages.findMany({
		where: and(
			eq(stages.competitionId, competition.id),
			eq(stages.type, 'PLAY'),
		),
		with: {
			divisions: {
				with: {
					teams: {
						columns: {
							id: true,
						},
					},
					games: {
						columns: {
							id: true,
							teamAId: true,
							teamBId: true,
							scoreTeamA: true,
							scoreTeamB: true,
						},
					},
				},
			},
		},
	})

	playStages.sort((a, b) => a.id - b.id)
	playStages.forEach((stage) => stage.divisions.sort((a, b) => a.id - b.id))

	return {
		organization,
		competition,
		registrationStage,
		playStages,
	}
}

function buildTeamRegistry(registrationStage: Awaited<ReturnType<typeof loadCompetitionContext>>['registrationStage']) {
	const teamRegistry = new Map<number, TeamRegistryEntry>()

	for (const division of registrationStage.divisions) {
		for (const team of division.teams) {
			teamRegistry.set(team.id, {
				teamId: team.id,
				teamName: team.name,
				registrationDivisionId: division.id,
				registrationDivisionName: division.name,
				registrationDivisionLevel: division.level,
			})
		}
	}

	return teamRegistry
}

function calculateStageStandings(
	stage: Pick<Stage, 'id' | 'name' | 'urlSlug'>,
	division: Pick<Division, 'id' | 'name' | 'level'> & {
		teams: Array<{ id: number }>
		games: Array<{ id: number; teamAId: number; teamBId: number; scoreTeamA: number | null; scoreTeamB: number | null }>
	},
	teamRegistry: Map<number, TeamRegistryEntry>,
): StageStandingRow[] {
	const scoringRules = hooks.getDivisionScoringRules({ stage, division })
	const standingsByTeamId = new Map<number, StageStandingRow>()
	const participantIds = new Set<number>(division.teams.map((team) => team.id))

	for (const game of division.games) {
		participantIds.add(game.teamAId)
		participantIds.add(game.teamBId)
	}

	for (const participantId of participantIds) {
		const team = teamRegistry.get(participantId)
		if (!team) {
			continue
		}

		standingsByTeamId.set(team.teamId, createEmptyStageStandingRow(team, division))
	}

	for (const game of division.games) {
		if (game.scoreTeamA === null || game.scoreTeamB === null) {
			continue
		}

		const teamARow = standingsByTeamId.get(game.teamAId)
		const teamBRow = standingsByTeamId.get(game.teamBId)
		if (!teamARow || !teamBRow) {
			continue
		}

		applyGameResult(teamARow, game.scoreTeamA, game.scoreTeamB, scoringRules)
		applyGameResult(teamBRow, game.scoreTeamB, game.scoreTeamA, scoringRules)
	}

	const rows = Array.from(standingsByTeamId.values())

	for (const row of rows) {
		const team = teamRegistry.get(row.teamId)
		if (!team) {
			continue
		}

		row.penalties = hooks.getPenaltyPoints({
			stage,
			division,
			team,
			row: {
				teamId: row.teamId,
				teamName: row.teamName,
				divisionId: row.divisionId,
				divisionName: row.divisionName,
				divisionLevel: row.divisionLevel,
				gamesWon: row.gamesWon,
				gamesLost: row.gamesLost,
				pointsFor: row.pointsFor,
				pointsAgainst: row.pointsAgainst,
				leaguePoints: row.leaguePoints,
                movementLeaguePointsUp: 0,
                movementLeaguePointsDown: 0,
			},
		})
		row.coefficient = computeCoefficient(row.pointsFor, row.pointsAgainst)
	}

	const context: StageStandingContext = { stage, division, rows }
	const rankedRows = [...rows].sort((a, b) => hooks.compareStageStandings(a, b, context))


	rankedRows.forEach((row, rankingIndex) => {
		row.movementLeaguePointsUp = hooks.getMovementLeaguePointsUp({
			stage,
			division,
			rows: rankedRows,
			row,
			rankingIndex,
		})
		row.movementLeaguePointsDown = hooks.getMovementLeaguePointsDown({
			stage,
			division,
			rows: rankedRows,
			row,
			rankingIndex,
		})
		row.leaguePoints += row.movementLeaguePointsUp + row.movementLeaguePointsDown
		row.leaguePointsMinusPenalties = row.leaguePoints - row.penalties
	})

	return rankedRows
}

function aggregateTotalStandings(teamRegistry: Map<number, TeamRegistryEntry>, stageRows: StageStandingRow[]): TotalStandingRow[] {
	const totalsByTeamId = new Map<number, TotalStandingRow>()

	for (const team of teamRegistry.values()) {
		totalsByTeamId.set(team.teamId, {
			teamId: team.teamId,
			teamName: team.teamName,
			registrationDivisionId: team.registrationDivisionId,
			registrationDivisionName: team.registrationDivisionName,
			registrationDivisionLevel: team.registrationDivisionLevel,
			gamesWon: 0,
			gamesLost: 0,
			pointsFor: 0,
			pointsAgainst: 0,
			penalties: 0,
			leaguePoints: 0,
			movementLeaguePointsUp: 0,
			movementLeaguePointsDown: 0,
			coefficient: null,
			leaguePointsMinusPenalties: 0,
		})
	}

	for (const row of stageRows) {
		const total = totalsByTeamId.get(row.teamId)
		if (!total) {
			continue
		}

		total.gamesWon += row.gamesWon
		total.gamesLost += row.gamesLost
		total.pointsFor += row.pointsFor
		total.pointsAgainst += row.pointsAgainst
		total.penalties += row.penalties
		total.leaguePoints += row.leaguePoints
		total.movementLeaguePointsUp += row.movementLeaguePointsUp
        total.movementLeaguePointsDown += row.movementLeaguePointsDown
	}

	const totals = Array.from(totalsByTeamId.values())
	for (const row of totals) {
		row.coefficient = computeCoefficient(row.pointsFor, row.pointsAgainst)
		row.leaguePointsMinusPenalties = row.leaguePoints - row.penalties
	}

	return totals.sort((a, b) => hooks.compareTotalStandings(a, b))
}

function printTotalStandings(rows: TotalStandingRow[], competitionName: string): void {
	console.log(`\nTotal standings for ${competitionName}\n`)
	console.table(
		rows.map((row, index) => ({
			Rank: index + 1,
			Team: row.teamName,
			// Division: row.registrationDivisionName,
			GW: row.gamesWon,
			GL: row.gamesLost,
			// PF: row.pointsFor,
			// PA: row.pointsAgainst,
			Coef: row.coefficient ?? '--',
			// Penalties: row.penalties,
			MvLPUp: row.movementLeaguePointsUp,
			MvLPDown: row.movementLeaguePointsDown,
			LP: row.leaguePoints,
			'LP-P': row.leaguePointsMinusPenalties,
		})),
	)
}

async function run(): Promise<void> {
	const { competition, registrationStage, playStages } = await loadCompetitionContext()
	const teamRegistry = buildTeamRegistry(registrationStage)

	if (teamRegistry.size === 0) {
		throw new Error(`No registration teams found for ${COMPETITION_SLUG}`)
	}

	const allStageRows: StageStandingRow[] = []

	for (const stage of playStages) {
		for (const division of stage.divisions) {
			allStageRows.push(...calculateStageStandings(stage, division, teamRegistry))
		}
	}

	const totalRows = aggregateTotalStandings(teamRegistry, allStageRows)

	console.log(`Competition: ${competition.name}`)
	console.log(`Registration stage: ${registrationStage.name}`)
	console.log(`Play stages processed: ${playStages.length}`)
	console.log(`Teams included: ${teamRegistry.size}`)

	printTotalStandings(totalRows, competition.name)
}

await run()
