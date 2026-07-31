import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSessionPrincipal } from '@/server/auth.server'

export type { AuthPrincipal } from '@/server/auth.server'

export const requireAdminPrincipal = createServerFn({ method: 'GET' }).handler(
  async () => {
    const principal = await getSessionPrincipal()

    if (!principal || principal.type !== 'admin') {
      throw redirect({
        to: '/org/$orgUrlSlug/competition/$competitionUrlSlug',
        params: { orgUrlSlug: 'cvc', competitionUrlSlug: 'cvc-grass-2026' },
        reloadDocument: true,
      })
    }

    return principal
  },
)
