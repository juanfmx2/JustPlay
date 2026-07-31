import { createFileRoute } from '@tanstack/react-router'

const COMPETITION_PATH = '/org/cvc/competition/cvc-grass-2026'

export const Route = createFileRoute('/logout-exit')({
  component: LogoutExitPage,
})

function LogoutExitPage() {
  return (
    <section className="container py-4">
      <div className="col-12 col-md-6 mx-auto">
        <div className="card shadow-sm">
          <div className="card-body text-center">
            <h1 className="h4 mb-3">Logged Out</h1>
            <p className="mb-3">You have been logged out.</p>
            <a className="btn btn-banana" href={COMPETITION_PATH}>
              Return to competition
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
