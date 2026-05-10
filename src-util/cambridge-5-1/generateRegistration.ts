import { and, eq } from 'drizzle-orm'

import { db } from '../../src/db/client'
import { competitions, stages } from '../../src/schema/competition'
import { divisions } from '../../src/schema/division'
import { organizations } from '../../src/schema/organization'
import { teams } from '../../src/schema/team'

const ORGANIZATION_SLUG = 'cambridge-5-1'
const COMPETITION_SLUG = 'banana-cup'

const TEAMS = ['Apples', 'Banana', 'Cranberries']

function slugify(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

async function getOrCreateOrganization() {
	const existing = await db
		.select()
		.from(organizations)
		.where(eq(organizations.urlSlug, ORGANIZATION_SLUG))
		.limit(1)

	if (existing[0]) return existing[0]

	const [created] = await db
		.insert(organizations)
		.values({
			name: 'Cambridge 5-1',
			urlSlug: ORGANIZATION_SLUG,
			description: 'Cambridge 5-1',
            contactEmail: 'juanfmx2@gmail.com'
		})
		.returning()

	return created
}

async function getOrCreateCompetition(organizationId: number) {
	const existing = await db
		.select()
		.from(competitions)
		.where(
			and(
				eq(competitions.organizationId, organizationId),
				eq(competitions.urlSlug, COMPETITION_SLUG),
			),
		)
		.limit(1)

	if (existing[0]) return existing[0]

	const [created] = await db
		.insert(competitions)
		.values({
			organizationId,
			name: 'Banana Cup',
			description: 'Banana Cup by Cambridge 5-1',
			type: 'SEASON',
			format: 'League',
			urlSlug: COMPETITION_SLUG,
		})
		.returning()

	return created
}

async function getOrCreateRegistrationStage(competitionId: number) {
	const existing = await db
		.select()
		.from(stages)
		.where(eq(stages.competitionId, competitionId))

	const registration = existing.find((s) => s.type === 'REGISTRATION')
	if (registration) return registration

	const [created] = await db
		.insert(stages)
		.values({
			competitionId,
			name: 'Registration',
			description: 'Registration stage for Banana Cup',
			urlSlug: 'registration',
			type: 'REGISTRATION',
		})
		.returning()

	return created
}

async function upsertDivisionAndTeams(stageId: number) {
	const divisionSlug = 'div-1'

	const existingDivision = await db
		.select()
		.from(divisions)
		.where(and(eq(divisions.stageId, stageId), eq(divisions.urlSlug, divisionSlug)))
		.limit(1)

	const division = existingDivision[0]
		? (
				await db
					.update(divisions)
					.set({
						name: 'Division 1',
						description: 'Banana Cup - Division 1',
						level: 'div 1',
						type: 'MIXED',
					})
					.where(eq(divisions.id, existingDivision[0].id))
					.returning()
			)[0]
		: (
				await db
					.insert(divisions)
					.values({
						stageId,
						name: 'Division 1',
						description: 'Banana Cup - Division 1',
						level: 'div 1',
						type: 'MIXED',
						urlSlug: divisionSlug,
					})
					.returning()
			)[0]

	let loadedTeams = 0

	for (const teamName of TEAMS) {
		const teamSlug = `${COMPETITION_SLUG}-${slugify(teamName)}`

		const existingTeam = await db
			.select()
			.from(teams)
			.where(eq(teams.urlSlug, teamSlug))
			.limit(1)

		if (existingTeam[0]) {
			await db
				.update(teams)
				.set({ divisionId: division.id, name: teamName })
				.where(eq(teams.id, existingTeam[0].id))
		} else {
			await db.insert(teams).values({
				divisionId: division.id,
				name: teamName,
				urlSlug: teamSlug,
			})
		}

		loadedTeams += 1
	}

	return loadedTeams
}

async function run() {
	const organization = await getOrCreateOrganization()
	const competition = await getOrCreateCompetition(organization.id)
	const registrationStage = await getOrCreateRegistrationStage(competition.id)

	await db
		.update(competitions)
		.set({ registrationStageId: registrationStage.id })
		.where(eq(competitions.id, competition.id))

	const loadedTeams = await upsertDivisionAndTeams(registrationStage.id)

	console.log(
		`Loaded Banana Cup data: org=${organization.urlSlug}, competition=${competition.urlSlug}, stage=${registrationStage.type}, teams=${loadedTeams}`,
	)
}

await run()
