import scoresData from '../../data/spring-league-w2-scores.json'
import { registerScoresFromJson } from './registerScoresFromJson'

const ORGANIZATION_SLUG = 'cvc'
const COMPETITION_SLUG = 'spring-league-2026'
const WEEK_STAGE_SLUG = 'week-2'

async function run() {
	await registerScoresFromJson({
		organizationSlug: ORGANIZATION_SLUG,
		competitionSlug: COMPETITION_SLUG,
		weekStageSlug: WEEK_STAGE_SLUG,
		rawScoresData: scoresData as unknown,
		reportLabel: 'Week 2',
	})
}

await run()
