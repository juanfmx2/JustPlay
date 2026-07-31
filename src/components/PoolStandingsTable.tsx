import { TrophyFill } from 'react-bootstrap-icons'
import type { RankableStandingRow, RankedStandingRow } from '@/domain/standingsRanking'

export type PoolStandingRow = RankedStandingRow<
  RankableStandingRow & {
    teamId: number
    gamesWon: number | null
    gamesLost: number | null
    setsCoefficient: string | null
    coefficient: string | null
  }
>

type Props = {
  rows: PoolStandingRow[]
  isAdmin: boolean
  pendingRowId?: number | null
  onSetTieBreakWinner?: (winnerId: number | null, groupIds: number[]) => void
}

function asDisplayNumber(value: number | null): string {
  return value === null ? '--' : String(value)
}

function asDisplayCoefficient(value: string | null, numerator: number | null): string {
  if (value !== null) return value
  // A null coefficient means the denominator was 0: either the team hasn't
  // played yet (numerator also 0, nothing to show) or it has a perfect
  // record (numerator > 0, so the ratio is effectively infinite).
  return (numerator ?? 0) > 0 ? '∞' : '--'
}

export function PoolStandingsTable({ rows, isAdmin, pendingRowId, onSetTieBreakWinner }: Props) {
  if (rows.length === 0) {
    return <p className="text-body-secondary mb-0">No standings records found yet.</p>
  }

  const groupIdsByKey = new Map<string, number[]>()
  for (const row of rows) {
    const existing = groupIdsByKey.get(row.tieGroupKey) ?? []
    existing.push(row.id)
    groupIdsByKey.set(row.tieGroupKey, existing)
  }

  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover align-middle mb-0">
        <thead>
          <tr>
            <th scope="col" className="text-center">#</th>
            <th scope="col">Team</th>
            <th scope="col" className="text-center">P</th>
            <th scope="col" className="text-center">W</th>
            <th scope="col" className="text-center">L</th>
            <th scope="col" className="text-center">SF</th>
            <th scope="col" className="text-center">SA</th>
            <th scope="col" className="text-center">S.Coef</th>
            <th scope="col" className="text-center">PF</th>
            <th scope="col" className="text-center">PA</th>
            <th scope="col" className="text-center">P.Coef</th>
            <th scope="col" className="text-center">LP</th>
            {isAdmin ? <th scope="col" className="text-center">Tie-break</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const played = (row.gamesWon ?? 0) + (row.gamesLost ?? 0)
            const hasBonus = (row.adminBonusPoints ?? 0) > 0
            const groupIds = groupIdsByKey.get(row.tieGroupKey) ?? [row.id]
            const isPending = pendingRowId === row.id

            return (
              <tr key={row.id} className={row.isTied ? 'table-warning' : undefined}>
                <th scope="row" className="text-center">{row.rank}</th>
                <td style={{ minWidth: '8rem', maxWidth: '16rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  {row.teamName}
                  {hasBonus ? (
                    <TrophyFill className="ms-2 text-warning" title="Admin tie-break winner" />
                  ) : null}
                </td>
                <td className="text-center">{played}</td>
                <td className="text-center">{asDisplayNumber(row.gamesWon)}</td>
                <td className="text-center">{asDisplayNumber(row.gamesLost)}</td>
                <td className="text-center">{asDisplayNumber(row.setsFor)}</td>
                <td className="text-center">{asDisplayNumber(row.setsAgainst)}</td>
                <td className="text-center">{asDisplayCoefficient(row.setsCoefficient, row.setsFor)}</td>
                <td className="text-center">{asDisplayNumber(row.pointsFor)}</td>
                <td className="text-center">{asDisplayNumber(row.pointsAgainst)}</td>
                <td className="text-center">{asDisplayCoefficient(row.coefficient, row.pointsFor)}</td>
                <td className="text-center fw-semibold">{asDisplayNumber(row.leaguePoints)}</td>
                {isAdmin ? (
                  <td className="text-center">
                    {row.isTied || hasBonus ? (
                      <button
                        type="button"
                        className={`btn btn-sm ${hasBonus ? 'btn-warning' : 'btn-outline-secondary'}`}
                        disabled={isPending}
                        onClick={() => onSetTieBreakWinner?.(hasBonus ? null : row.id, groupIds)}
                      >
                        {hasBonus ? 'Undo' : 'Pick as winner'}
                      </button>
                    ) : (
                      <span className="text-body-secondary">--</span>
                    )}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
