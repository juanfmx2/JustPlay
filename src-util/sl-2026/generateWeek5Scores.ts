import { and, eq } from 'drizzle-orm'

import scoresData from '../../data/spring-league-w5-scores.json'
import { recalculateStandingsForStage } from '../../src/domain/scorer'
import { db } from '../../src/db/client'
import { competitions, organizations, stages, standings, teams } from '../../src/schema'
import { registerScoresFromJson } from './registerScoresFromJson'

const ORGANIZATION_SLUG = 'cvc'
const COMPETITION_SLUG = 'spring-league-2026'
const WEEK_STAGE_SLUG = 'week-5'
const PENALTY_TEAM_NAME = 'Net Ninjas'


async function run() {
	await registerScoresFromJson({
		organizationSlug: ORGANIZATION_SLUG,
		competitionSlug: COMPETITION_SLUG,
		weekStageSlug: WEEK_STAGE_SLUG,
		rawScoresData: scoresData as unknown,
		reportLabel: 'Week 5',
	})

}

await run()