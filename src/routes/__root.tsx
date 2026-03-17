import type { ReactNode } from 'react'
import { useEffect } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { ThemeProvider } from '../hooks/ThemeContextProvider'
import { NavBar } from '../components/NavBar'
import 'bootstrap/dist/css/bootstrap.min.css'
import '../styles/styles.css'


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
  return (
    <RootDocument>
      <ThemeProvider>
        <SiteLayout>
          <Outlet />
        </SiteLayout>
      </ThemeProvider>
    </RootDocument>
  )
}

function SiteLayout({ children }: {readonly children: ReactNode }) {

  // Bootstrap JS is browser-only; import it lazily on the client
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
  }, [])

  return (
    <>
      <NavBar />
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
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}