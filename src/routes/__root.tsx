import type { ReactNode } from 'react'
import { useEffect } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ThemeProvider } from '../hooks/ThemeContextProvider'
import { NavBar } from '../components/NavBar'
import { getSessionPrincipal, type AuthPrincipal } from '@/server/auth'
import 'bootstrap/dist/css/bootstrap.min.css'
import '../styles/styles.css'

const loadSessionPrincipal = createServerFn({ method: 'GET' }).handler(async () => {
  return getSessionPrincipal()
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'JustPlay',
      },
    ],
  }),
  loader: async () => ({ principal: await loadSessionPrincipal() }),
  component: RootComponent,
  notFoundComponent: () => (
    <div>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <a href="/">Go home</a>
    </div>
  )
})

function RootComponent() {
  const { principal } = Route.useLoaderData()

  return (
    <RootDocument>
      <ThemeProvider>
        <SiteLayout principal={principal}>
          <Outlet />
        </SiteLayout>
      </ThemeProvider>
    </RootDocument>
  )
}

function SiteLayout({ children, principal }: { readonly children: ReactNode; readonly principal: AuthPrincipal | null }) {

  // Bootstrap JS is browser-only; import it lazily on the client
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
  }, [])

  return (
    <>
      <NavBar principal={principal} />
      <main className="container-fluid py-4">
        {children}
      </main>
    </>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <link rel="icon" type="image/png" href="/img/favicon/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/img/favicon/favicon.svg" />
        <link rel="shortcut icon" href="/img/favicon/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/img/favicon/apple-touch-icon.png" />
        <link rel="manifest" href="/img/favicon/site.webmanifest" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}