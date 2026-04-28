import { and, eq } from 'drizzle-orm'
import { organizations, competitions, stages, divisions, teams, Stage } from '@/schema'
import { getDivisionTeamsAndStandingsSortedByStandings } from '@/schema/queries/division'
import { db } from '@/db/client'

const cvcOrg = await db.query.organizations.findFirst({
    where: eq(organizations.urlSlug, 'cvc')
})
if (!cvcOrg || !cvcOrg.id) {
    throw new Error('CVC organization not found')
}
const slComp = await db.query.competitions.findFirst({
    where: and(eq(competitions.organizationId, cvcOrg.id), eq(competitions.urlSlug, 'spring-league-2026'))
})
if (!slComp || !slComp.id) {
    throw new Error('Spring League 2026 competition not found')
}

const stage1 = await db.query.stages.findFirst({
      where: and(eq(stages.competitionId, slComp.id), eq(stages.urlSlug, 'week-1')),
    })
if (!stage1 || !stage1.id) {
    throw new Error('Week 1 stage not found')
}

console.log(stage1)

export async function transitionStage(stage: Stage) {
    console.log(`Transitioning stage ${stage.name} (${stage.urlSlug})`)
    const compDivs = await db.query.divisions.findMany({
        where: eq(divisions.stageId, stage.id)
    })
    for (const div of compDivs) {
        const teamsByStandings = await getDivisionTeamsAndStandingsSortedByStandings(div.id)
        console.log(`Division ${div.name} has ${teamsByStandings.length} teams`)
    }
}

transitionStage(stage1) 