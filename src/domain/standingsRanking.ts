// Ranks standings rows per data/rules.json's "All Matches" tie-break order:
//   1. League points (1 per set won)
//   2. Sets For/Against coefficient
//   3. Points For/Against coefficient
//   4. Points For
//   5. Admin bonus point (manual coin-toss resolution - the only tie-break
//      that isn't derived purely from match results)
//   6. Team name (stable fallback, not a real rule)

export type RankableStandingRow = {
  id: number
  teamName: string
  leaguePoints: number | null
  setsFor: number | null
  setsAgainst: number | null
  pointsFor: number | null
  pointsAgainst: number | null
  adminBonusPoints: number | null
}

export type RankedStandingRow<T extends RankableStandingRow> = T & {
  rank: number
  // True when this row is part of a group that ties on every rule-based
  // criterion (i.e. before the admin bonus is considered) - a "coin toss"
  // situation.
  isTied: boolean
  // Rows sharing this key are exactly tied before the admin bonus - use it
  // to find the sibling rows to clear when an admin picks a new winner.
  tieGroupKey: string
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return numerator === 0 ? 0 : Number.POSITIVE_INFINITY
  return numerator / denominator
}

function naturalTieKey(row: RankableStandingRow): string {
  const leaguePoints = row.leaguePoints ?? 0
  const setsRatio = ratio(row.setsFor ?? 0, row.setsAgainst ?? 0)
  const pointsRatio = ratio(row.pointsFor ?? 0, row.pointsAgainst ?? 0)
  const pointsFor = row.pointsFor ?? 0
  return `${leaguePoints}|${setsRatio}|${pointsRatio}|${pointsFor}`
}

export function rankStandings<T extends RankableStandingRow>(rows: T[]): Array<RankedStandingRow<T>> {
  const tieKeyCounts = new Map<string, number>()
  for (const row of rows) {
    const key = naturalTieKey(row)
    tieKeyCounts.set(key, (tieKeyCounts.get(key) ?? 0) + 1)
  }

  const sorted = [...rows].sort((a, b) => {
    const leaguePointsA = a.leaguePoints ?? 0
    const leaguePointsB = b.leaguePoints ?? 0
    if (leaguePointsB !== leaguePointsA) return leaguePointsB - leaguePointsA

    const setsRatioA = ratio(a.setsFor ?? 0, a.setsAgainst ?? 0)
    const setsRatioB = ratio(b.setsFor ?? 0, b.setsAgainst ?? 0)
    if (setsRatioB !== setsRatioA) return setsRatioB - setsRatioA

    const pointsRatioA = ratio(a.pointsFor ?? 0, a.pointsAgainst ?? 0)
    const pointsRatioB = ratio(b.pointsFor ?? 0, b.pointsAgainst ?? 0)
    if (pointsRatioB !== pointsRatioA) return pointsRatioB - pointsRatioA

    const pointsForA = a.pointsFor ?? 0
    const pointsForB = b.pointsFor ?? 0
    if (pointsForB !== pointsForA) return pointsForB - pointsForA

    const bonusA = a.adminBonusPoints ?? 0
    const bonusB = b.adminBonusPoints ?? 0
    if (bonusB !== bonusA) return bonusB - bonusA

    return a.teamName.localeCompare(b.teamName)
  })

  return sorted.map((row, index) => {
    const key = naturalTieKey(row)
    return {
      ...row,
      rank: index + 1,
      isTied: (tieKeyCounts.get(key) ?? 1) > 1,
      tieGroupKey: key,
    }
  })
}
