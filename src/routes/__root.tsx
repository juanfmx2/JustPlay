import type { ReactNode } from 'react'
import { useEffect } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import 'bootstrap/dist/css/bootstrap.min.css'

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
})

function RootComponent() {
  return (
    <RootDocument>
      <SiteLayout>
        <Outlet />
      </SiteLayout>
    </RootDocument>
  )
}

function SiteLayout({ children }: { readonly children: ReactNode }) {
  // Bootstrap JS is browser-only; import it lazily on the client
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
  }, [])

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-body-tertiary sticky-top shadow-sm">
        <div className="container-fluid">

          {/* Logo */}
          <a className="navbar-brand fw-bold fs-4" href="/">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              fill="currentColor"
              className="me-2 align-text-bottom"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M1.5 8a6.5 6.5 0 0 1 4-6M14.5 8a6.5 6.5 0 0 1-4 6M8 1.5v13" />
            </svg>
            JustPlay
          </a>

          {/* Mobile toggle */}
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarContent"
            aria-controls="navbarContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>

          {/* Collapsible: nav links + search */}
          <div className="collapse navbar-collapse" id="navbarContent">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <a className="nav-link active" aria-current="page" href="/">
                  Home
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/teams">
                  Teams
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/schedule">
                  Schedule
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/about">
                  About
                </a>
              </li>
            </ul>

            {/* Search bar */}
            <form className="d-flex" role="search">
              <input
                className="form-control me-2"
                type="search"
                placeholder="Search..."
                aria-label="Search"
              />
              <button className="btn btn-outline-primary" type="submit">
                Search
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="container-fluid py-4">
        {children}
      </main>
    </>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
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