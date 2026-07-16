import { Outlet, createRootRoute, type RootRoute } from '@tanstack/react-router'
import { Header } from './components/Header'
import { AuthSessionProvider } from './hooks/useAuthSession'
import { ThemeProvider } from './hooks/useTheme'
import './styles/globals.css'

const RootLayout = () => {
  return (
    <ThemeProvider>
      <AuthSessionProvider>
        <Header />
        <main className="main-content">
          <Outlet />

          <footer className="footer">
            <div className="footer-content">
              <p>
                <strong>JustPlay</strong> - Sports Logistics Made Simple
              </p>
              <p style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.5rem' }}>
                Empowering sports organizations with reliable, scalable logistics tools.
              </p>
            </div>
          </footer>
        </main>
      </AuthSessionProvider>
    </ThemeProvider>
  )
}

export const Route: RootRoute = createRootRoute({
  component: RootLayout,
})
