import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

type DivisionLink = {
  id: number
  label: string
  scheduleLabel: string
  to: '/spring-league/div-1' | '/spring-league/div-2' | '/spring-league/div-3' | '/spring-league/div-4'
}

const DIVISIONS: DivisionLink[] = [
  {
    id: 1,
    label: 'Division - 1 - Thursdays at NCA',
    scheduleLabel: 'Thursdays at NCA',
    to: '/spring-league/div-1',
  },
  {
    id: 2,
    label: 'Division - 2 - Thursdays at NCA',
    scheduleLabel: 'Thursdays at NCA',
    to: '/spring-league/div-2',
  },
  {
    id: 3,
    label: 'Division - 3 - Fridays at The Perse',
    scheduleLabel: 'Fridays at The Perse',
    to: '/spring-league/div-3',
  },
  {
    id: 4,
    label: 'Division - 4 - Fridays at The Perse',
    scheduleLabel: 'Fridays at The Perse',
    to: '/spring-league/div-4',
  },
]

export const Route = createFileRoute('/spring-league')({
  component: SpringLeague,
})

function SpringLeague() {
  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-2">Spring League</h1>
        <p className="text-body-secondary mb-0">
          Four-division league with weekly round-robin match days and rotating referee duties.
        </p>
      </header>

      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="h4 mb-3">Schedule</h2>
          <ul className="list-group list-group-flush">
            {DIVISIONS.map((division) => (
              <li key={division.id} className="list-group-item px-0">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                  <Link to={division.to} className="link-primary fw-semibold">
                    {division.label}
                  </Link>
                  <span className="text-body-secondary small">{division.scheduleLabel}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Outlet />
    </section>
  )
}
