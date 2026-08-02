import rulesData from '../../data/rules.json'
import {
  buildMatchRuleProfilesFromRules,
  generatePlayoffPlaceholders,
  getCompetitionOrThrow,
  getOrCreateSundayStage,
  loadSundayDivisionFiles,
  regenerateStandingsForCompetition,
  type RulesData,
} from './generateSunday'

async function runSundayPlayoffGeneration() {
  const competition = await getCompetitionOrThrow()
  const sundayStage = await getOrCreateSundayStage(competition.id)
  const divisionFiles = await loadSundayDivisionFiles()
  const matchRuleProfiles = buildMatchRuleProfilesFromRules(rulesData as RulesData)

  const playoffGeneration = await generatePlayoffPlaceholders({
    sundayStageId: sundayStage.id,
    divisionFiles,
    matchRuleProfiles,
  })

  const totalStandings = await regenerateStandingsForCompetition(competition.id)

  console.log(
    `Generated sunday playoffs for ${competition.urlSlug}: games=${playoffGeneration.generatedGames}, gameSets=${playoffGeneration.generatedGameSets}, standings=${totalStandings}`,
  )
}

await runSundayPlayoffGeneration()