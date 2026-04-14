import { and, eq } from 'drizzle-orm'

import { db } from '../../db/client'
import { stages } from '../competition'
import { divisions, type DivisionWithTeamsGamesAndSets } from '../division'

export async function getDivisionWithTeamsAndGames(input: {
  stageUrlSlug: string
  divUrlSlug: string
}): Promise<DivisionWithTeamsGamesAndSets | null> {
  const stage = await db.query.stages.findFirst({
    where: eq(stages.urlSlug, input.stageUrlSlug),
  })

  if (!stage) {
    return null
  }

  const division = await db.query.divisions.findFirst({
    where: and(eq(divisions.stageId, stage.id), eq(divisions.urlSlug, input.divUrlSlug)),
    with: {
      teams: {
        orderBy: (team, { asc }) => [asc(team.name)],
      },
      games: {
        orderBy: (game, { asc }) => [asc(game.startTime), asc(game.id)],
        with: {
          teamA: true,
          teamB: true,
          reffingTeam: true,
          gameSets: {
            with: {
              court: {
                with: {
                  venue: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return (division as DivisionWithTeamsGamesAndSets | undefined) ?? null
}
