import { eq } from 'drizzle-orm'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import {
  findPrincipalByToken,
  getSessionPrincipal,
  setSessionPrincipal,
  clearSessionPrincipal,
} from '@/server/auth.server'
import { db } from '@/db/client'
import { teams } from '@/schema'
import { COMPETITION_PATH } from '@/lib/routePaths'

type LoginOutcome =
  | { outcome: 'success'; principalType: 'admin' | 'team' }
  | { outcome: 'switched' }
  | { outcome: 'invalid' }

const loginWithToken = createServerFn({ method: 'GET' })
  .inputValidator((token: string) => token)
  .handler(async ({ data: token }): Promise<LoginOutcome> => {
    const principal = findPrincipalByToken(token)

    if (!principal) {
      return { outcome: 'invalid' }
    }

    const existing = await getSessionPrincipal()

    if (existing && (existing.type !== principal.type || existing.name !== principal.name)) {
      await clearSessionPrincipal()
      return { outcome: 'switched' }
    }

    await setSessionPrincipal(principal)

    if (principal.type === 'team') {
      await db.update(teams).set({ lastLoginAt: new Date() }).where(eq(teams.name, principal.name))
    }

    return { outcome: 'success', principalType: principal.type }
  })

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    auth_token: typeof search.auth_token === 'string' ? search.auth_token : undefined,
  }),
  loaderDeps: ({ search }) => ({ authToken: search.auth_token }),
  loader: async ({ deps }) => {
    if (!deps.authToken) {
      return { status: 'missing' as const }
    }

    const result = await loginWithToken({ data: deps.authToken })

    if (result.outcome === 'success') {
      if (result.principalType === 'admin') {
        throw redirect({ to: '/admins', reloadDocument: true })
      }

      throw redirect({
        to: '/org/$orgUrlSlug/competition/$competitionUrlSlug',
        params: { orgUrlSlug: 'cvc', competitionUrlSlug: 'cvc-grass-2026' },
        reloadDocument: true,
      })
    }

    if (result.outcome === 'switched') {
      throw redirect({ to: '/logout-exit', reloadDocument: true })
    }

    return { status: 'invalid' as const }
  },
  component: LoginPage,
})

function LoginPage() {
  const result = Route.useLoaderData()

  const message =
    result.status === 'missing'
      ? 'No token was provided. Use the link you were given to log in.'
      : 'That token is not valid. Please check the link you were given.'

  return (
    <section className="container py-4">
      <div className="col-12 col-md-6 mx-auto">
        <div className="card shadow-sm">
          <div className="card-body text-center">
            <h1 className="h4 mb-3">Login Error</h1>
            <p className="text-danger mb-3">{message}</p>
            <a className="btn btn-banana" href={COMPETITION_PATH}>
              Return to competition
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
