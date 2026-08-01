export function StandingsLegend() {
  return (
    <div className="mb-4">
      <div className="table-responsive">
        <table className="table table-sm table-bordered mb-2 w-auto">
          <tbody>
            <tr>
              <th scope="row">P</th>
              <td>Played</td>
              <th scope="row">W</th>
              <td>Won</td>
              <th scope="row">L</th>
              <td>Lost</td>
            </tr>
            <tr>
              <th scope="row">SF</th>
              <td>Sets For</td>
              <th scope="row">SA</th>
              <td>Sets Against</td>
              <th scope="row">S.Coef</th>
              <td>Sets For/Against coefficient</td>
            </tr>
            <tr>
              <th scope="row">PF</th>
              <td>Points For</td>
              <th scope="row">PA</th>
              <td>Points Against</td>
              <th scope="row">P.Coef</th>
              <td>Points For/Against coefficient</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-body-secondary small mb-0">
        <span className="badge text-bg-warning-subtle text-warning-emphasis me-2">Highlighted rows</span>
        are tied on sets coefficient, points coefficient, and points for - per the rules, a coin toss
        decides the order.
      </p>
    </div>
  )
}
