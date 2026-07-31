import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { clearSessionPrincipal } from '@/server/auth'

const logoutSession = createServerFn({ method: 'GET' }).handler(async () => {
  await clearSessionPrincipal()
})

export const Route = createFileRoute('/logout')({
  loader: async () => {
    await logoutSession()
    throw redirect({ to: '/logout-exit', reloadDocument: true })
  },
  component: () => null,
})
