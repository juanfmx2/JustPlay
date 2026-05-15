import { and, eq } from 'drizzle-orm'

import scoresData from '../../data/spring-league-w4-scores.json'
import { recalculateStandingsForStage } from '../../src/domain/scorer'
import { db } from '../../src/db/client'
import { competitions, organizations, stages, standings, teams } from '../../src/schema'
import { registerScoresFromJson } from './registerScoresFromJson'

const ORGANIZATION_SLUG = 'cvc'
const COMPETITION_SLUG = 'spring-league-2026'
const WEEK_STAGE_SLUG = 'week-4'
const PENALTY_TEAM_NAME = 'Net Ninjas'
const WEEK_4_PENALTY_POINTS = 1

async function applyWeek4PenaltyToNetNinjas() {
	const organization = await db.query.organizations.findFirst({
		where: eq(organizations.urlSlug, ORGANIZATION_SLUG),
	})

	if (!organization) {
		throw new Error(`Organization ${ORGANIZATION_SLUG} not found.`)
	}

	const competition = await db.query.competitions.findFirst({
		where: and(
			eq(competitions.organizationId, organization.id),
			eq(competitions.urlSlug, COMPETITION_SLUG),
		),
	})

	if (!competition) {
		throw new Error(`Competition ${COMPETITION_SLUG} not found for organization ${ORGANIZATION_SLUG}.`)
	}

	const week4Stage = await db.query.stages.findFirst({
		where: and(
			eq(stages.competitionId, competition.id),
			eq(stages.urlSlug, WEEK_STAGE_SLUG),
		),
	})

	if (!week4Stage) {
		throw new Error(`Stage ${WEEK_STAGE_SLUG} not found for competition ${COMPETITION_SLUG}.`)
	}

	const team = await db.query.teams.findFirst({
		where: eq(teams.name, PENALTY_TEAM_NAME),
	})

	if (!team) {
		throw new Error(`Team ${PENALTY_TEAM_NAME} not found.`)
	}

	const week4Standing = await db.query.standings.findFirst({
		where: and(
			eq(standings.stageId, week4Stage.id),
			eq(standings.teamId, team.id),
		),
	})

	if (!week4Standing) {
		throw new Error(`No week-4 standing row found for ${PENALTY_TEAM_NAME}.`)
	}

	await db
		.update(standings)
		.set({ penalties: WEEK_4_PENALTY_POINTS })
		.where(eq(standings.id, week4Standing.id))

	await recalculateStandingsForStage(week4Stage.id)

	console.log(
		`Applied week-4 penalty: ${PENALTY_TEAM_NAME} -> penalties=${WEEK_4_PENALTY_POINTS}`,
	)
}

async function run() {
	await registerScoresFromJson({
		organizationSlug: ORGANIZATION_SLUG,
		competitionSlug: COMPETITION_SLUG,
		weekStageSlug: WEEK_STAGE_SLUG,
		rawScoresData: scoresData as unknown,
		reportLabel: 'Week 4',
	})

	await applyWeek4PenaltyToNetNinjas()
}

await run()