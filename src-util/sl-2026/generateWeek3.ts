import { progressWeek } from './progressWeek'

const ORGANIZATION_SLUG = 'cvc'
const COMPETITION_SLUG = 'spring-league-2026'
const CURRENT_WEEK_STAGE_SLUG = 'week-2'

async function run() {
	await progressWeek({
		organizationSlug: ORGANIZATION_SLUG,
		competitionSlug: COMPETITION_SLUG,
		currentWeekStageSlug: CURRENT_WEEK_STAGE_SLUG,
	})
}

await run()
