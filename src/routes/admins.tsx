import { createFileRoute } from '@tanstack/react-router'

import { requireAdminPrincipal } from '@/server/auth'
import { COMPETITION_PATH } from '@/lib/routePaths'

export const Route = createFileRoute('/admins')({
  loader: async () => ({ principal: await requireAdminPrincipal() }),
  component: AdminsPage,
})

function AdminsPage() {
  const { principal } = Route.useLoaderData()

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">Admin Dashboard</h1>
        <p className="text-body-secondary mb-0">Welcome, {principal.name}.</p>
      </header>

      <div className="d-flex flex-wrap gap-2">
        <a className="btn btn-banana" href={COMPETITION_PATH}>
          Go to Competition
        </a>
        <a className="btn btn-outline-secondary" href="/admin/login-qr-codes">
          Login QR Codes
        </a>
      </div>
    </section>
  )
}
