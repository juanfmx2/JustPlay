import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { findPrincipalByToken, getSessionPrincipal, setSessionPrincipal, clearSessionPrincipal } from '@/server/auth'

const COMPETITION_PATH = '/org/cvc/competition/cvc-grass-2026'

const loginWithToken = createServerFn({ method: 'GET' })
  .inputValidator((token: string) => token)
  .handler(async ({ data: token }): Promise<'success' | 'switched' | 'invalid'> => {
    const principal = findPrincipalByToken(token)

    if (!principal) {
      return 'invalid'
    }

    const existing = await getSessionPrincipal()

    if (existing && (existing.type !== principal.type || existing.name !== principal.name)) {
      await clearSessionPrincipal()
      return 'switched'
    }

    await setSessionPrincipal(principal)
    return 'success'
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

    const outcome = await loginWithToken({ data: deps.authToken })

    if (outcome === 'success') {
      throw redirect({
        to: '/org/$orgUrlSlug/competition/$competitionUrlSlug',
        params: { orgUrlSlug: 'cvc', competitionUrlSlug: 'cvc-grass-2026' },
        reloadDocument: true,
      })
    }

    if (outcome === 'switched') {
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
