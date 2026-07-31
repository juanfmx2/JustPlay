import type { ReactNode } from 'react'
import { useEffect } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { and, eq, ne } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { ThemeProvider } from '../hooks/ThemeContextProvider'
import { NavBar } from '../components/NavBar'
import { db } from '@/db/client'
import { getSessionPrincipal, type AuthPrincipal } from '@/server/auth.server'
import { competitions, organizations, stages, teams } from '@/schema'
import 'bootstrap/dist/css/bootstrap.min.css'
import '../styles/styles.css'

const loadSessionPrincipal = createServerFn({ method: 'GET' }).handler(async () => {
  return getSessionPrincipal()
})

const DEFAULT_ORG_SLUG = 'cvc'
const DEFAULT_COMPETITION_SLUG = 'cvc-grass-2026'

const loadTeamLatestScheduleHref = createServerFn({ method: 'GET' }).handler(async () => {
  const principal = await getSessionPrincipal()

  if (!principal || principal.type !== 'team') {
    return null
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.urlSlug, DEFAULT_ORG_SLUG),
  })
  if (!organization) return null

  const competition = await db.query.competitions.findFirst({
    where: and(
      eq(competitions.organizationId, organization.id),
      eq(competitions.urlSlug, DEFAULT_COMPETITION_SLUG),
    ),
  })
  if (!competition) return null

  const matchingTeams = await db.query.teams.findMany({
    where: eq(teams.name, principal.name),
    columns: { id: true },
  })
  if (matchingTeams.length === 0) return null

  const teamIds = new Set(matchingTeams.map((team) => team.id))

  const playStages = await db.query.stages.findMany({
    where: and(eq(stages.competitionId, competition.id), ne(stages.type, 'REGISTRATION')),
    with: {
      divisions: {
        with: {
          teams: {
            columns: { id: true },
          },
          games: {
            columns: {
              id: true,
              teamAId: true,
              teamBId: true,
              startTime: true,
            },
          },
        },
      },
    },
  })

  const candidates: Array<{
    stageId: number
    stageSlug: string
    divisionId: number
    divisionSlug: string
    latestTimeMs: number
  }> = []

  for (const stage of playStages) {
    if (!stage.urlSlug) continue

    for (const division of stage.divisions) {
      if (!division.urlSlug) continue

      const inDivisionTeams = division.teams.some((team) => teamIds.has(team.id))
      const inDivisionGames = division.games.some(
        (game) => teamIds.has(game.teamAId) || teamIds.has(game.teamBId),
      )

      if (!inDivisionTeams && !inDivisionGames) continue

      const latestTimeMs = division.games.reduce((acc, game) => {
        const t = game.startTime?.getTime() ?? Number.NEGATIVE_INFINITY
        return t > acc ? t : acc
      }, Number.NEGATIVE_INFINITY)

      candidates.push({
        stageId: stage.id,
        stageSlug: stage.urlSlug,
        divisionId: division.id,
        divisionSlug: division.urlSlug,
        latestTimeMs,
      })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (b.latestTimeMs !== a.latestTimeMs) return b.latestTimeMs - a.latestTimeMs
    if (b.stageId !== a.stageId) return b.stageId - a.stageId
    return b.divisionId - a.divisionId
  })

  const latest = candidates[0]
  return `/org/${DEFAULT_ORG_SLUG}/competition/${DEFAULT_COMPETITION_SLUG}/stg/${latest.stageSlug}/${latest.divisionSlug}`
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
  loader: async () => {
    const principal = await loadSessionPrincipal()
    const teamLatestScheduleHref = await loadTeamLatestScheduleHref()

    return {
      principal,
      teamLatestScheduleHref,
    }
  },
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
  const { principal, teamLatestScheduleHref } = Route.useLoaderData()

  return (
    <RootDocument>
      <ThemeProvider>
        <SiteLayout principal={principal} teamLatestScheduleHref={teamLatestScheduleHref}>
          <Outlet />
        </SiteLayout>
      </ThemeProvider>
    </RootDocument>
  )
}

function SiteLayout({ children, principal, teamLatestScheduleHref }: {
  readonly children: ReactNode
  readonly principal: AuthPrincipal | null
  readonly teamLatestScheduleHref: string | null
}) {

  // Bootstrap JS is browser-only; import it lazily on the client
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
  }, [])

  return (
    <>
      <NavBar principal={principal} teamLatestScheduleHref={teamLatestScheduleHref} />
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