export function StandingsConventions() {
  return (
    <div className="mt-3 p-3 border rounded bg-body-secondary small">
      <p className="fw-semibold mb-1">Conventions</p>
      <ul className="mb-0 ps-3">
        <li><b>GW</b> — Games Won</li>
        <li><b>GL</b> — Games Lost</li>
        <li><b>PF</b> — Points For</li>
        <li><b>PA</b> — Points Against</li>
        <li><b>Coef.</b> — Coefficient (PF / PA)</li>
        <li><b>P</b> — Penalties</li>
        <li><b>LP</b> — League Points</li>
        <li><b>LP-P</b> — League Points minus Penalties</li>
        <li><span className="badge text-bg-success">Green</span> — Promotion spot (1st place moves up a division next week)</li>
        <li><span className="badge text-bg-danger">Red</span> — Relegation spot (last place moves down a division next week)</li>
      </ul>
    </div>
  )
}
