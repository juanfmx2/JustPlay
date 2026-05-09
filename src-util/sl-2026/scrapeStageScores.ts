import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from 'playwright'

const DIVISION_SLUGS = ['div-1', 'div-2', 'div-3', 'div-4'] as const

type ScoreEntry = {
	division: number
	teamA: string
	teamB: string
	scoreTeamA: number
	scoreTeamB: number
}

type ScoresFile = {
	weekStageSlug: string
	matches: ScoreEntry[]
}

function printUsageAndExit(): never {
	console.error(
		'Usage: pnpm scrape:sl-scores <stage-base-url> <output-file>\nExample: pnpm scrape:sl-scores https://choco.pizza/org/cvc/competition/spring-league-2026/stg/week-3 data/spring-league-w3-scores.json',
	)
	process.exit(1)
}

function normalizeStageBaseUrl(rawUrl: string): string {
	const trimmedUrl = rawUrl.trim().replace(/\/+$/, '')
	const parsedUrl = new URL(trimmedUrl)
	const match = /\/stg\/([^/?#]+)$/i.exec(parsedUrl.pathname)

	if (!match) {
		throw new Error(
			`Invalid stage base URL: ${rawUrl}. Expected a URL ending in /stg/week-N.`,
		)
	}

	return parsedUrl.toString().replace(/\/+$/, '')
	}

function parseWeekStageSlug(stageBaseUrl: string): string {
	const parsedUrl = new URL(stageBaseUrl)
	const match = /\/stg\/([^/?#]+)$/i.exec(parsedUrl.pathname)

	if (!match) {
		throw new Error(`Could not determine week stage slug from URL: ${stageBaseUrl}`)
	}

	return match[1]
}

function parseArgs(argv: string[]): { stageBaseUrl: string; outputFile: string } {
	if (argv.length !== 2) {
		printUsageAndExit()
	}

	return {
		stageBaseUrl: normalizeStageBaseUrl(argv[0]),
		outputFile: argv[1],
	}
}

function buildDivisionUrl(stageBaseUrl: string, divisionSlug: string): string {
	return `${stageBaseUrl}/${divisionSlug}`
}

function formatScoresJson(data: ScoresFile): string {
	const lines = ['{', `  "weekStageSlug": ${JSON.stringify(data.weekStageSlug)},`, '  "matches": [']

	data.matches.forEach((match, index) => {
		const previousDivision = index > 0 ? data.matches[index - 1].division : null
		if (previousDivision !== null && previousDivision !== match.division) {
			lines.push('')
		}

		const suffix = index === data.matches.length - 1 ? '' : ','
		lines.push(
			`    { "division": ${match.division}, "teamA": ${JSON.stringify(match.teamA)}, "teamB": ${JSON.stringify(match.teamB)}, "scoreTeamA": ${match.scoreTeamA}, "scoreTeamB": ${match.scoreTeamB} }${suffix}`,
		)
	})

	lines.push('  ]', '}', '')
	return lines.join('\n')
}

async function scrapeDivisionScores(stageBaseUrl: string, divisionSlug: string, division: number): Promise<ScoreEntry[]> {
	const browser = await chromium.launch({ headless: true })
	const page = await browser.newPage()

	try {
		const url = buildDivisionUrl(stageBaseUrl, divisionSlug)
		await page.goto(url, { waitUntil: 'networkidle' })

		const articles = await page.locator('main article').all()
		const matches: ScoreEntry[] = []

		for (const article of articles) {
			const scoreInputs = article.locator('[aria-label^="Score for "]')
			const scoreCount = await scoreInputs.count()

			if (scoreCount < 2) {
				continue
			}

			const teamAInput = scoreInputs.nth(0)
			const teamBInput = scoreInputs.nth(1)

			const teamALabel = await teamAInput.getAttribute('aria-label')
			const teamBLabel = await teamBInput.getAttribute('aria-label')
			const rawScoreTeamA = await teamAInput.inputValue()
			const rawScoreTeamB = await teamBInput.inputValue()

			if (!teamALabel || !teamBLabel) {
				continue
			}

			const scoreTeamA = Number(rawScoreTeamA)
			const scoreTeamB = Number(rawScoreTeamB)

			if (!Number.isFinite(scoreTeamA) || !Number.isFinite(scoreTeamB)) {
				continue
			}

			matches.push({
				division,
				teamA: teamALabel.replace(/^Score for /, '').trim(),
				teamB: teamBLabel.replace(/^Score for /, '').trim(),
				scoreTeamA,
				scoreTeamB,
			})
		}

		if (matches.length === 0) {
			throw new Error(`No scored matches found at ${url}`)
		}

		return matches
	} finally {
		await page.close()
		await browser.close()
	}
}

async function writeScoresFile(outputFile: string, data: ScoresFile): Promise<void> {
	const resolvedPath = path.resolve(outputFile)
	await mkdir(path.dirname(resolvedPath), { recursive: true })
	await writeFile(resolvedPath, formatScoresJson(data), 'utf8')
	console.log(`Wrote ${data.matches.length} matches to ${resolvedPath}`)
}

async function run(): Promise<void> {
	const { stageBaseUrl, outputFile } = parseArgs(process.argv.slice(2))
	const weekStageSlug = parseWeekStageSlug(stageBaseUrl)
	const matches: ScoreEntry[] = []

	for (const [index, divisionSlug] of DIVISION_SLUGS.entries()) {
		const division = index + 1
		const divisionMatches = await scrapeDivisionScores(stageBaseUrl, divisionSlug, division)
		matches.push(...divisionMatches)
		console.log(`Scraped ${divisionMatches.length} matches from ${divisionSlug}`)
	}

	await writeScoresFile(outputFile, {
		weekStageSlug,
		matches,
	})
	}

await run()