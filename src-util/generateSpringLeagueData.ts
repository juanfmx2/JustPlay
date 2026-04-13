import { and, eq } from 'drizzle-orm'

import springLeagueData from '../data/spring-league.json'
import { db } from '../src/db/client'
import { competitions, stages } from '../src/schema/competition'
import { divisions } from '../src/schema/division'
import { organizations } from '../src/schema/organization'
import { teams } from '../src/schema/team'
import { courts, venueBookings, venues } from '../src/schema/venue'

type SpringLeagueDivision = {
	division_name: string
	division_short: string
	teams: Array<{
		team_name: string
		captain: string
	}>
}

const ORGANIZATION_SLUG = 'cvc'
const COMPETITION_SLUG = 'spring-league-2026'
const TOTAL_WEEKS = 5

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
			name: 'Cambridge Volleyball Club',
			urlSlug: ORGANIZATION_SLUG,
			description: 'Cambridge Volleyball Club',
			contactEmail: 'contact@cambridgevolleyball.club',
		})
		.returning()

	return created
}

async function getOrCreateCompetition(organizationId: number) {
	const existing = await db
		.select()
		.from(competitions)
		.where(eq(competitions.urlSlug, COMPETITION_SLUG))
		.limit(1)

	if (existing[0]) return existing[0]

	const [created] = await db
		.insert(competitions)
		.values({
			organizationId,
			name: 'Spring League 2026',
			description: 'Spring League 2026 by Cambridge Volleyball Club',
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
			description: 'Registration stage for Spring League 2026',
			urlSlug: 'registration',
			type: 'REGISTRATION',
		})
		.returning()

	return created
}

async function upsertDivisionsAndTeams(stageId: number, data: SpringLeagueDivision[]) {
	let loadedTeams = 0

	for (const divisionEntry of data) {
		const divisionSlug = slugify(divisionEntry.division_short)

		const existingDivision = await db
			.select()
			.from(divisions)
			.where(eq(divisions.urlSlug, divisionSlug))
			.limit(1)

		const division = existingDivision[0]
			? (
					await db
						.update(divisions)
						.set({
							stageId,
							name: divisionEntry.division_name,
							description: `Spring League 2026 - ${divisionEntry.division_short}`,
							level: divisionEntry.division_short,
							type: 'MIXED',
							urlSlug: divisionSlug,
						})
						.where(eq(divisions.id, existingDivision[0].id))
						.returning()
				)[0]
			: (
					await db
						.insert(divisions)
						.values({
							stageId,
							name: divisionEntry.division_name,
							description: `Spring League 2026 - ${divisionEntry.division_short}`,
							level: divisionEntry.division_short,
							type: 'MIXED',
							urlSlug: divisionSlug,
						})
						.returning()
				)[0]

		for (const teamEntry of divisionEntry.teams) {
			const teamSlug = `${COMPETITION_SLUG}-${slugify(teamEntry.team_name)}`

			const existingTeam = await db
				.select()
				.from(teams)
				.where(eq(teams.urlSlug, teamSlug))
				.limit(1)

			if (existingTeam[0]) {
				await db
					.update(teams)
					.set({
						divisionId: division.id,
						name: teamEntry.team_name,
						description: `Captain: ${teamEntry.captain}`,
					})
					.where(eq(teams.id, existingTeam[0].id))
			} else {
				await db.insert(teams).values({
					divisionId: division.id,
					name: teamEntry.team_name,
					description: `Captain: ${teamEntry.captain}`,
					urlSlug: teamSlug,
				})
			}

			loadedTeams += 1
		}
	}

	return loadedTeams
}

async function getOrCreateVenue(name: string, description: string) {
	const existing = await db
		.select()
		.from(venues)
		.where(eq(venues.name, name))
		.limit(1)

	if (existing[0]) return existing[0]

	const [created] = await db
		.insert(venues)
		.values({ name, description })
		.returning()

	return created
}

async function getOrCreateCourt(venueId: number, name: string) {
	const existing = await db
		.select()
		.from(courts)
		.where(and(eq(courts.venueId, venueId), eq(courts.name, name)))
		.limit(1)

	if (existing[0]) return existing[0]

	const [created] = await db
		.insert(courts)
		.values({ venueId, name })
		.returning()

	return created
}

function addDays(baseDate: Date, days: number) {
	return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)
}

function withHour(baseDate: Date, hour: number) {
	const date = new Date(baseDate)
	date.setHours(hour, 0, 0, 0)
	return date
}

async function getOrCreateBooking(competitionId: number, venueId: number, startTime: Date, endTime: Date) {
	const existing = await db
		.select()
		.from(venueBookings)
		.where(
			and(
				eq(venueBookings.competitionId, competitionId),
				eq(venueBookings.venueId, venueId),
				eq(venueBookings.startTime, startTime),
				eq(venueBookings.endTime, endTime),
			),
		)
		.limit(1)

	if (existing[0]) return false

	await db.insert(venueBookings).values({
		competitionId,
		venueId,
		startTime,
		endTime,
	})

	return true
}

async function upsertSpringLeagueVenuesAndBookings(competitionId: number) {
	const ncaVenue = await getOrCreateVenue(
		'North Cambridge Academy (NCA)',
		'Weekly Spring League venue',
	)
	const perseVenue = await getOrCreateVenue('The Perse', 'Weekly Spring League venue')

	await getOrCreateCourt(ncaVenue.id, 'Sports Hall')
	await getOrCreateCourt(perseVenue.id, 'Sports Hall A')
	await getOrCreateCourt(perseVenue.id, 'Sports Hall B')

	const firstThursday = new Date('2026-04-23T00:00:00+01:00')
	let createdBookings = 0

	for (let week = 0; week < TOTAL_WEEKS; week += 1) {
		const thursday = addDays(firstThursday, week * 7)
		const friday = addDays(thursday, 1)

		const thursdayStart = withHour(thursday, 18)
		const thursdayEnd = withHour(thursday, 22)
		const fridayStart = withHour(friday, 18)
		const fridayEnd = withHour(friday, 22)

		if (await getOrCreateBooking(competitionId, ncaVenue.id, thursdayStart, thursdayEnd)) {
			createdBookings += 1
		}
		if (await getOrCreateBooking(competitionId, ncaVenue.id, fridayStart, fridayEnd)) {
			createdBookings += 1
		}
		if (await getOrCreateBooking(competitionId, perseVenue.id, fridayStart, fridayEnd)) {
			createdBookings += 1
		}
	}

	return {
		createdBookings,
		totalExpected: TOTAL_WEEKS * 3,
	}
}

async function run() {
	const data = springLeagueData as SpringLeagueDivision[]

	const organization = await getOrCreateOrganization()
	const competition = await getOrCreateCompetition(organization.id)
	const registrationStage = await getOrCreateRegistrationStage(competition.id)

	await db
		.update(competitions)
		.set({ registrationStageId: registrationStage.id })
		.where(eq(competitions.id, competition.id))

	const loadedTeams = await upsertDivisionsAndTeams(registrationStage.id, data)
	const bookingsResult = await upsertSpringLeagueVenuesAndBookings(competition.id)

	console.log(
		`Loaded Spring League data: org=${organization.urlSlug}, competition=${competition.urlSlug}, stage=${registrationStage.type}, teams=${loadedTeams}, bookings=${bookingsResult.totalExpected} (new ${bookingsResult.createdBookings})`,
	)
}

await run()
