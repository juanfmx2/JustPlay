import { createRoute, createRouter } from '@tanstack/react-router'
import App from './App'
import { Route as RootRoute } from './__root'

const AboutPage = () => (
  <article className="content">
    <h2>About JustPlay</h2>
    <p>
      JustPlay helps organizers run leagues, tournaments, and sessions with clear workflows,
      predictable operations, and consistent participant experiences.
    </p>
  </article>
)

const LeaguesPage = () => (
  <article className="content">
    <h2>Leagues</h2>
    <p>
      League operations will include registration windows, division management, standings,
      and scheduling tools designed for incremental rollout.
    </p>
  </article>
)

const SignInPage = () => (
  <article className="content">
    <h2>Sign In</h2>
    <p>Authentication flows are planned in the AUTH domain requirements and upcoming increments.</p>
  </article>
)

const indexRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: App,
})

const aboutRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/about',
  component: AboutPage,
})

const leaguesRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/leagues',
  component: LeaguesPage,
})

const signInRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/sign-in',
  component: SignInPage,
})

const routeTree = RootRoute.addChildren([indexRoute, aboutRoute, leaguesRoute, signInRoute])

type RouterHistory = Parameters<typeof createRouter>[0]['history']

export const createAppRouter = (history?: RouterHistory) =>
  createRouter({
    routeTree,
    history,
  })

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
