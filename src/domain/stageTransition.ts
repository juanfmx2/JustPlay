import { and, eq } from 'drizzle-orm'

import { db } from '@/db/client'
import {
    appendSundayAdvancedMarker,
    appendSundayPlayoffDivisionAdvancedMarker,
    isPlayoffDivisionLevel,
    isPlayoffPlaceholderGameDescription,
    isSundayStageAdvanced,
    isSundayPlayoffDivisionAdvanced,
    PLAYOFF_DIVISION_LEVEL_SUFFIX,
    SUNDAY_ADVANCED_MARKER_PREFIX,
    SUNDAY_STAGE_SLUG,
} from '@/domain/sundayStage'
import { rankStandings } from '@/domain/standingsRanking'
import { competitions, divisions, games, organizations, stages, standings } from '@/schema'

type ParsedDivisionLevel = {
    genderCode: 'M' | 'MX' | 'W'
    divisionNumber: number
    poolSlug: string
    groupKey: string
}

type SundayPoolGroup = {
    key: string
    poolsByLetter: Map<string, { id: number; level: string }>
}

type RankingRow = {
    id: number
    teamId: number
    teamName: string
    gamesWon: number
    setsFor: number
    setsAgainst: number
    pointsFor: number
    pointsAgainst: number
    adminBonusPoints: number
}

export type AdvanceSundayStageResult = {
    alreadyAdvanced: boolean
    updatedGames: number
    updatedGroups: number
    marker: string
}

export type AdvanceSundayPlayoffDivisionResult = {
    alreadyAdvanced: boolean
    updatedGames: number
    marker: string
    divisionName: string
}

function parseDivisionLevel(level: string): ParsedDivisionLevel | null {
    const match = level.match(/^(M|MX|W)-(\d+)-(.+)$/i)
    if (!match) return null

    const genderCode = match[1].toUpperCase() as 'M' | 'MX' | 'W'
    const divisionNumber = Number(match[2])
    const poolSlug = match[3]
    if (!Number.isInteger(divisionNumber)) return null

    return {
        genderCode,
        divisionNumber,
        poolSlug,
        groupKey: `${genderCode}-${divisionNumber}`,
    }
}

function getPoolLetter(poolSlug: string): string | null {
    return /^[a-z]$/i.test(poolSlug) ? poolSlug.toUpperCase() : null
}

function hasExactLetters(poolLetters: string[], expected: string[]): boolean {
    const actual = [...new Set(poolLetters)].sort()
    const wanted = [...expected].sort()
    return actual.length === wanted.length && actual.every((value, index) => value === wanted[index])
}

function findGameByTeams(
    divisionGames: Array<{ id: number; teamA: { name: string }; teamB: { name: string } }>,
    team1Name: string,
    team2Name: string,
): { id: number } {
    const found = divisionGames.find((game) => {
        const names = [game.teamA.name, game.teamB.name]
        return names.includes(team1Name) && names.includes(team2Name)
    })

    if (!found) {
        throw new Error(`Could not find playoff placeholder game for ${team1Name} vs ${team2Name}.`)
    }

    return { id: found.id }
}

function findPlayoffGameByDescriptionTag(
    divisionGames: Array<{ id: number; description: string | null }>,
    tag: 'AB_FINAL' | 'SF1' | 'SF2',
): { id: number } {
    const found = divisionGames.find((game) => game.description?.includes(`| ${tag} |`))
    if (!found) {
        throw new Error(`Could not find playoff placeholder game with tag ${tag}.`)
    }

    return { id: found.id }
}

async function getTopRankedTeamForDivision(
    stageId: number,
    divisionId: number,
): Promise<{ id: number; name: string }> {
    const ranked = await getRankedTeamsForDivision(stageId, divisionId)
    const top = ranked[0]
    if (!top) {
        throw new Error(`Could not determine top team for division #${divisionId}.`)
    }

    return top
}

async function getRankedTeamsForDivision(
    stageId: number,
    divisionId: number,
): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.query.standings.findMany({
        where: eq(standings.divisionId, divisionId),
        with: {
            team: {
                columns: { id: true, name: true },
            },
        },
    })

    const rankingRows: RankingRow[] = rows
        .filter((row) => row.stageId === stageId && row.team !== null)
        .map((row) => ({
            id: row.id,
            teamId: row.teamId,
            teamName: row.team?.name ?? `Team ${row.teamId}`,
            gamesWon: row.gamesWon ?? 0,
            setsFor: row.setsFor ?? 0,
            setsAgainst: row.setsAgainst ?? 0,
            pointsFor: row.pointsFor ?? 0,
            pointsAgainst: row.pointsAgainst ?? 0,
            adminBonusPoints: row.adminBonusPoints ?? 0,
        }))

    if (rankingRows.length === 0) {
        throw new Error(`No standings rows found for division #${divisionId}.`)
    }

    const ranked = rankStandings(rankingRows)
    return ranked.map((row) => ({
        id: row.teamId,
        name: row.teamName,
    }))
}

async function getBottomRankedTeamsForDivisions(
    stageId: number,
    divisionIds: number[],
    count: number,
): Promise<Array<{ id: number; name: string }>> {
    if (divisionIds.length === 0) {
        throw new Error('Cannot determine referee teams without source divisions.')
    }

    const rankedPerDivision = await Promise.all(
        divisionIds.map((divisionId) => getRankedTeamsForDivision(stageId, divisionId)),
    )

    const combined = rankedPerDivision.flat()
    if (combined.length < count) {
        throw new Error(`Not enough ranked teams (${combined.length}) to select ${count} referee team(s).`)
    }

    return combined.slice(-count).reverse()
}

function getSundayPoolGroups(stageDivisions: Array<{ id: number; level: string }>): SundayPoolGroup[] {
    const groups = new Map<string, SundayPoolGroup>()

    for (const division of stageDivisions) {
        if (isPlayoffDivisionLevel(division.level)) continue

        const parsed = parseDivisionLevel(division.level)
        if (!parsed) continue

        const poolLetter = getPoolLetter(parsed.poolSlug)
        if (!poolLetter) continue

        const current = groups.get(parsed.groupKey) ?? {
            key: parsed.groupKey,
            poolsByLetter: new Map<string, { id: number; level: string }>(),
        }

        current.poolsByLetter.set(poolLetter, { id: division.id, level: division.level })
        groups.set(parsed.groupKey, current)
    }

    return Array.from(groups.values())
}

function parsePlayoffDivisionLevel(level: string): { groupKey: string } | null {
    const match = level.match(/^(M|MX|W)-(\d+)-PLAYOFF$/i)
    if (!match) return null
    return { groupKey: `${match[1].toUpperCase()}-${match[2]}` }
}

function getRequiredPoolLettersForPlayoffDivision(playoffGameCount: number): string[] {
    return playoffGameCount <= 1 ? ['A', 'B'] : ['A', 'B', 'C', 'D']
}

export async function advanceSundayStage(input: {
    orgUrlSlug: string
    competitionUrlSlug: string
    stageUrlSlug: string
}): Promise<AdvanceSundayStageResult> {
    const organization = await db.query.organizations.findFirst({
        where: eq(organizations.urlSlug, input.orgUrlSlug),
    })
    if (!organization) {
        throw new Error(`Organization ${input.orgUrlSlug} not found.`)
    }

    const resolvedCompetition = await db.query.competitions.findFirst({
        where: and(
            eq(competitions.urlSlug, input.competitionUrlSlug),
            eq(competitions.organizationId, organization.id),
        ),
    })

    if (!resolvedCompetition) {
        throw new Error(`Competition ${input.competitionUrlSlug} not found for ${input.orgUrlSlug}.`)
    }

    const stage = await db.query.stages.findFirst({
        where: and(
            eq(stages.urlSlug, input.stageUrlSlug),
            eq(stages.competitionId, resolvedCompetition.id),
        ),
    })

    if (!stage) {
        throw new Error(`Stage ${input.stageUrlSlug} not found for this competition.`)
    }

    if (stage.urlSlug !== SUNDAY_STAGE_SLUG) {
        throw new Error('Stage advance is only implemented for Sunday stage right now.')
    }

    if (isSundayStageAdvanced(stage.description)) {
        const marker = (stage.description ?? '').split('\n').find((line) => line.includes(SUNDAY_ADVANCED_MARKER_PREFIX)) ?? ''
        return {
            alreadyAdvanced: true,
            updatedGames: 0,
            updatedGroups: 0,
            marker,
        }
    }

    const stageDivisions = await db.query.divisions.findMany({
        where: eq(divisions.stageId, stage.id),
        with: {
            games: {
                with: {
                    teamA: { columns: { name: true } },
                    teamB: { columns: { name: true } },
                },
            },
        },
    })

    const poolDivisions = stageDivisions.filter((division) => !isPlayoffDivisionLevel(division.level))
    const poolGames = poolDivisions.flatMap((division) => division.games)

    const allPoolGamesAdminValidated =
        poolGames.length > 0 && poolGames.every((game) => game.adminValidatedAt !== null)

    if (!allPoolGamesAdminValidated) {
        throw new Error('Sunday stage can only advance when all pool games are admin-validated.')
    }

    let updatedGames = 0
    let updatedGroups = 0

    const poolGroups = getSundayPoolGroups(poolDivisions)

    for (const group of poolGroups) {
        const letters = Array.from(group.poolsByLetter.keys())
        const isAB = hasExactLetters(letters, ['A', 'B'])
        const isABCD = hasExactLetters(letters, ['A', 'B', 'C', 'D'])
        if (!isAB && !isABCD) continue

        const playoffDivisionLevel = `${group.key}${PLAYOFF_DIVISION_LEVEL_SUFFIX}`
        const playoffDivision = stageDivisions.find((division) => division.level.toUpperCase() === playoffDivisionLevel.toUpperCase())
        if (!playoffDivision) continue

        const playoffGames = playoffDivision.games.filter((game) =>
            isPlayoffPlaceholderGameDescription(game.description),
        )

        if (isAB) {
            const poolA = group.poolsByLetter.get('A')
            const poolB = group.poolsByLetter.get('B')
            if (!poolA || !poolB) continue

            const [teamA, teamB, [refTeam]] = await Promise.all([
                getTopRankedTeamForDivision(stage.id, poolA.id),
                getTopRankedTeamForDivision(stage.id, poolB.id),
                getBottomRankedTeamsForDivisions(stage.id, [poolA.id, poolB.id], 1),
            ])

            const targetGame = findPlayoffGameByDescriptionTag(playoffGames, 'AB_FINAL')
            await db
                .update(games)
                .set({
                    teamAId: teamA.id,
                    teamBId: teamB.id,
                    reffingTeamId: refTeam.id,
                    name: `${playoffDivision.level} - ${teamA.name} vs ${teamB.name}`,
                })
                .where(eq(games.id, targetGame.id))

            updatedGames += 1
            updatedGroups += 1
            continue
        }

        const poolA = group.poolsByLetter.get('A')
        const poolB = group.poolsByLetter.get('B')
        const poolC = group.poolsByLetter.get('C')
        const poolD = group.poolsByLetter.get('D')
        if (!poolA || !poolB || !poolC || !poolD) continue

        const [seedA, seedB, seedC, seedD, refTeams] = await Promise.all([
            getTopRankedTeamForDivision(stage.id, poolA.id),
            getTopRankedTeamForDivision(stage.id, poolB.id),
            getTopRankedTeamForDivision(stage.id, poolC.id),
            getTopRankedTeamForDivision(stage.id, poolD.id),
            getBottomRankedTeamsForDivisions(stage.id, [poolA.id, poolB.id, poolC.id, poolD.id], 2),
        ])
        const [lastOverall, secondLastOverall] = refTeams
        if (!lastOverall || !secondLastOverall) {
            throw new Error(`Could not determine referee teams for ${playoffDivision.name}.`)
        }

        const semi1 = findPlayoffGameByDescriptionTag(playoffGames, 'SF1')
        const semi2 = findPlayoffGameByDescriptionTag(playoffGames, 'SF2')

        await db
            .update(games)
            .set({
                teamAId: seedA.id,
                teamBId: seedD.id,
                reffingTeamId: lastOverall.id,
                name: `${playoffDivision.level} - SF1 ${seedA.name} vs ${seedD.name}`,
            })
            .where(eq(games.id, semi1.id))

        await db
            .update(games)
            .set({
                teamAId: seedB.id,
                teamBId: seedC.id,
                reffingTeamId: secondLastOverall.id,
                name: `${playoffDivision.level} - SF2 ${seedB.name} vs ${seedC.name}`,
            })
            .where(eq(games.id, semi2.id))

        updatedGames += 2
        updatedGroups += 1
    }

    const updatedDescription = appendSundayAdvancedMarker(stage.description)
    const marker = updatedDescription
        .split('\n')
        .find((line) => line.includes(SUNDAY_ADVANCED_MARKER_PREFIX)) ?? ''

    await db
        .update(stages)
        .set({ description: updatedDescription })
        .where(eq(stages.id, stage.id))

    return {
        alreadyAdvanced: false,
        updatedGames,
        updatedGroups,
        marker,
    }
}

export async function advanceSundayPlayoffDivision(input: {
    orgUrlSlug: string
    competitionUrlSlug: string
    stageUrlSlug: string
    divisionUrlSlug: string
}): Promise<AdvanceSundayPlayoffDivisionResult> {
    const organization = await db.query.organizations.findFirst({
        where: eq(organizations.urlSlug, input.orgUrlSlug),
    })
    if (!organization) {
        throw new Error(`Organization ${input.orgUrlSlug} not found.`)
    }

    const resolvedCompetition = await db.query.competitions.findFirst({
        where: and(
            eq(competitions.urlSlug, input.competitionUrlSlug),
            eq(competitions.organizationId, organization.id),
        ),
    })
    if (!resolvedCompetition) {
        throw new Error(`Competition ${input.competitionUrlSlug} not found for ${input.orgUrlSlug}.`)
    }

    const stage = await db.query.stages.findFirst({
        where: and(
            eq(stages.urlSlug, input.stageUrlSlug),
            eq(stages.competitionId, resolvedCompetition.id),
        ),
    })
    if (!stage) {
        throw new Error(`Stage ${input.stageUrlSlug} not found for this competition.`)
    }

    if (stage.urlSlug !== SUNDAY_STAGE_SLUG) {
        throw new Error('Playoff division advance is only implemented for Sunday stage right now.')
    }

    const stageDivisions = await db.query.divisions.findMany({
        where: eq(divisions.stageId, stage.id),
        with: {
            games: {
                with: {
                    teamA: { columns: { name: true } },
                    teamB: { columns: { name: true } },
                },
            },
        },
    })

    const targetDivision = stageDivisions.find((division) => division.urlSlug === input.divisionUrlSlug)
    if (!targetDivision) {
        throw new Error(`Division ${input.divisionUrlSlug} not found for this stage.`)
    }

    if (!isPlayoffDivisionLevel(targetDivision.level)) {
        throw new Error('This action only applies to playoff divisions.')
    }

    if (isSundayPlayoffDivisionAdvanced(targetDivision.description)) {
        const marker = (targetDivision.description ?? '')
            .split('\n')
            .find((line) => line.includes('[SUNDAY_PLAYOFF_DIVISION_ADVANCED_AT=')) ?? ''
        return {
            alreadyAdvanced: true,
            updatedGames: 0,
            marker,
            divisionName: targetDivision.name,
        }
    }

    const poolDivisions = stageDivisions.filter((division) => !isPlayoffDivisionLevel(division.level))
    const poolGroups = getSundayPoolGroups(poolDivisions)
    const playoffPlan = parsePlayoffDivisionLevel(targetDivision.level)
    if (!playoffPlan) {
        throw new Error(`Could not parse playoff division level ${targetDivision.level}.`)
    }

    const sourceGroup = poolGroups.find((group) => group.key === playoffPlan.groupKey)
    if (!sourceGroup) {
        throw new Error(`Could not find pool group for playoff division ${targetDivision.name}.`)
    }

    const letters = Array.from(sourceGroup.poolsByLetter.keys())
    const isAB = hasExactLetters(letters, ['A', 'B'])
    const isABCD = hasExactLetters(letters, ['A', 'B', 'C', 'D'])
    if (!isAB && !isABCD) {
        throw new Error(`Unsupported playoff layout for ${targetDivision.name}.`)
    }

    const requiredPoolLetters = getRequiredPoolLettersForPlayoffDivision(targetDivision.games.length)
    const sourcePoolDivisions = poolDivisions.filter((division) => {
        const parsed = parseDivisionLevel(division.level)
        if (!parsed) return false
        if (parsed.groupKey !== sourceGroup.key) return false

        const poolLetter = getPoolLetter(parsed.poolSlug)
        if (!poolLetter) return false

        return requiredPoolLetters.includes(poolLetter)
    })

    const allPoolGamesAdminValidated =
        sourcePoolDivisions.length > 0 &&
        sourcePoolDivisions.flatMap((division) => division.games).every((game) => game.adminValidatedAt !== null)
    if (!allPoolGamesAdminValidated) {
        throw new Error(`Playoff division ${targetDivision.name} can only advance when all source pool games are admin-validated.`)
    }

    const playoffGames = targetDivision.games.filter((game) => isPlayoffPlaceholderGameDescription(game.description))
    let updatedGames = 0

    if (isAB) {
        const poolA = sourceGroup.poolsByLetter.get('A')
        const poolB = sourceGroup.poolsByLetter.get('B')
        if (!poolA || !poolB) {
            throw new Error(`Missing pool A/B divisions for ${targetDivision.name}.`)
        }

        const [teamA, teamB, [refTeam]] = await Promise.all([
            getTopRankedTeamForDivision(stage.id, poolA.id),
            getTopRankedTeamForDivision(stage.id, poolB.id),
            getBottomRankedTeamsForDivisions(stage.id, [poolA.id, poolB.id], 1),
        ])

        const targetGame = findPlayoffGameByDescriptionTag(playoffGames, 'AB_FINAL')
        await db
            .update(games)
            .set({
                teamAId: teamA.id,
                teamBId: teamB.id,
                reffingTeamId: refTeam.id,
                name: `${targetDivision.level} - ${teamA.name} vs ${teamB.name}`,
            })
            .where(eq(games.id, targetGame.id))

        updatedGames = 1
    } else {
        const poolA = sourceGroup.poolsByLetter.get('A')
        const poolB = sourceGroup.poolsByLetter.get('B')
        const poolC = sourceGroup.poolsByLetter.get('C')
        const poolD = sourceGroup.poolsByLetter.get('D')
        if (!poolA || !poolB || !poolC || !poolD) {
            throw new Error(`Missing pool A/B/C/D divisions for ${targetDivision.name}.`)
        }

        const [seedA, seedB, seedC, seedD, refTeams] = await Promise.all([
            getTopRankedTeamForDivision(stage.id, poolA.id),
            getTopRankedTeamForDivision(stage.id, poolB.id),
            getTopRankedTeamForDivision(stage.id, poolC.id),
            getTopRankedTeamForDivision(stage.id, poolD.id),
            getBottomRankedTeamsForDivisions(stage.id, [poolA.id, poolB.id, poolC.id, poolD.id], 2),
        ])
        const [lastOverall, secondLastOverall] = refTeams
        if (!lastOverall || !secondLastOverall) {
            throw new Error(`Could not determine referee teams for ${targetDivision.name}.`)
        }

        const semi1 = findPlayoffGameByDescriptionTag(playoffGames, 'SF1')
        const semi2 = findPlayoffGameByDescriptionTag(playoffGames, 'SF2')

        await db
            .update(games)
            .set({
                teamAId: seedA.id,
                teamBId: seedD.id,
                reffingTeamId: lastOverall.id,
                name: `${targetDivision.level} - SF1 ${seedA.name} vs ${seedD.name}`,
            })
            .where(eq(games.id, semi1.id))

        await db
            .update(games)
            .set({
                teamAId: seedB.id,
                teamBId: seedC.id,
                reffingTeamId: secondLastOverall.id,
                name: `${targetDivision.level} - SF2 ${seedB.name} vs ${seedC.name}`,
            })
            .where(eq(games.id, semi2.id))

        updatedGames = 2
    }

    const updatedDescription = appendSundayPlayoffDivisionAdvancedMarker(targetDivision.description)
    const marker = updatedDescription
        .split('\n')
        .find((line) => line.includes('[SUNDAY_PLAYOFF_DIVISION_ADVANCED_AT=')) ?? ''

    await db
        .update(divisions)
        .set({ description: updatedDescription })
        .where(eq(divisions.id, targetDivision.id))

    return {
        alreadyAdvanced: false,
        updatedGames,
        marker,
        divisionName: targetDivision.name,
    }
}