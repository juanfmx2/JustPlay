import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { requireAdminPrincipal } from '@/server/auth'
import { loadLoginQrEntries, type LoginEntry } from '@/server/loginQrCodes.server'
import { COMPETITION_PATH } from '@/lib/routePaths'

const loadLoginQrData = createServerFn({ method: 'GET' }).handler(async () => {
  return loadLoginQrEntries()
})

export const Route = createFileRoute('/admin/login-qr-codes')({
  loader: async () => {
    await requireAdminPrincipal()
    return loadLoginQrData()
  },
  component: LoginQrCodesPage,
})

function EntryCard({ entry }: { readonly entry: LoginEntry }) {
  return (
    <div className="col">
      <div className="card h-100 shadow-sm">
        <div className="card-body text-center d-flex flex-column align-items-center gap-2">
          <h2 className="h6 mb-0">{entry.name}</h2>
          {entry.division ? <span className="badge text-bg-secondary">{entry.division}</span> : null}
          <div dangerouslySetInnerHTML={{ __html: entry.qrSvg }} />
          <a className="small" href={entry.url}>
            Open login link
          </a>
        </div>
      </div>
    </div>
  )
}

function LoginQrCodesPage() {
  const { admins, teams } = Route.useLoaderData()

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1 className="h2 mb-1">Login QR Codes</h1>
          <p className="text-body-secondary mb-0">Scan a code or share its link to log in as that admin or team.</p>
        </div>
        <a className="btn btn-outline-secondary" href={COMPETITION_PATH}>
          Back to Competition
        </a>
      </header>

      <h2 className="h4 mb-3">Admins</h2>
      <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-6 g-3 mb-5">
        {admins.map((entry) => (
          <EntryCard key={entry.name} entry={entry} />
        ))}
      </div>

      <h2 className="h4 mb-3">Teams</h2>
      <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-6 g-3">
        {teams.map((entry) => (
          <EntryCard key={entry.name} entry={entry} />
        ))}
      </div>
    </section>
  )
}
