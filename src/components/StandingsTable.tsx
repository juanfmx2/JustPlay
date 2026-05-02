import { Fragment } from 'react'

export type StandingRow = {
  id: number
  teamId: number
  teamName: string
  gamesWon: number | null
  gamesLost: number | null
  pointsFor: number | null
  pointsAgainst: number | null
  coefficient: string | null
  penalties: number | null
  leaguePoints: number | null
  leaguePointsMinusPenalties: number | null
}

type Props = {
  rows: StandingRow[]
  /** Numeric division level (1, 2, 3, 4 …). Used to determine promotion/relegation rows. */
  divNum: number
}

function asDisplayNumber(value: number | null): string {
  return value === null ? '--' : String(value)
}

function asDisplayCoefficient(value: string | null): string {
  return value === null ? '--' : value
}
export function StandingsTable({ rows, divNum }: Props) {
  const lastIndex = rows.length - 1
  const showPromotion = divNum >= 2
  const showRelegation = divNum <= 3

  function rowClass(index: number): string | undefined {
    if (index === 0 && showPromotion) return 'table-success'
    if (index === lastIndex && showRelegation) return 'table-danger'
    return undefined
  }

  if (rows.length === 0) {
    return <p className="text-body-secondary mb-0">No standings records found for this division yet.</p>
  }

  return (
    <>
      {/* Desktop */}
      <div className="table-responsive d-none d-md-block">
        <table className="table table-striped table-hover align-middle">
          <thead>
            <tr>
              <th scope="col" className="text-center">#</th>
              <th scope="col">Team</th>
              <th scope="col" className="text-center">GW</th>
              <th scope="col" className="text-center">GL</th>
              <th scope="col" className="text-center">PF</th>
              <th scope="col" className="text-center">PA</th>
              <th scope="col" className="text-center">Coef.</th>
              <th scope="col" className="text-center">P</th>
              <th scope="col" className="text-center">LP</th>
              <th scope="col" className="text-center">LP-P</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={rowClass(index)}>
                <th scope="row" className="text-center">{index + 1}</th>
                <td style={{ minWidth: '8rem', maxWidth: '16rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.teamName}</td>
                <td className="text-center">{asDisplayNumber(row.gamesWon)}</td>
                <td className="text-center">{asDisplayNumber(row.gamesLost)}</td>
                <td className="text-center">{asDisplayNumber(row.pointsFor)}</td>
                <td className="text-center">{asDisplayNumber(row.pointsAgainst)}</td>
                <td className="text-center">{asDisplayCoefficient(row.coefficient)}</td>
                <td className="text-center">{asDisplayNumber(row.penalties)}</td>
                <td className="text-center">{asDisplayNumber(row.leaguePoints)}</td>
                <td className="text-center">{asDisplayNumber(row.leaguePointsMinusPenalties)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="table-responsive d-md-none">
        <table className="table table-sm table-bordered align-middle mb-0">
          <thead>
            <tr>
              <th scope="col" className="text-center">Team</th>
              <th scope="col" className="text-center">GW</th>
              <th scope="col" className="text-center">GL</th>
              <th scope="col" className="text-center">PF</th>
              <th scope="col" className="text-center">PA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <Fragment key={row.id}>
                <tr className={rowClass(index)}>
                  <th scope="row" rowSpan={4} className="align-middle text-nowrap">
                    <div className="fw-semibold" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}><b>#{index + 1}</b> - {row.teamName}</div>
                  </th>
                  <td className="text-center">{asDisplayNumber(row.gamesWon)}</td>
                  <td className="text-center">{asDisplayNumber(row.gamesLost)}</td>
                  <td className="text-center">{asDisplayNumber(row.pointsFor)}</td>
                  <td className="text-center">{asDisplayNumber(row.pointsAgainst)}</td>
                </tr>
                <tr className={rowClass(index)}>
                  <td colSpan={2} className="text-center"><b>Coef.</b></td>
                  <td colSpan={2} className="text-center">{asDisplayCoefficient(row.coefficient)}</td>
                </tr>
                <tr className={rowClass(index)}>
                  <td className="text-center"><b>P</b></td>
                  <td className="text-center">{asDisplayNumber(row.penalties)}</td>
                  <td className="text-center"><b>LP</b></td>
                  <td className="text-center">{asDisplayNumber(row.leaguePoints)}</td>
                </tr>
                <tr className={rowClass(index)}>
                  <td colSpan={2} className="text-center"><b>LP-P</b></td>
                  <td colSpan={2} className="text-center">{asDisplayNumber(row.leaguePointsMinusPenalties)}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
