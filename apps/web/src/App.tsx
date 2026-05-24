import React from 'react'
import '../styles/globals.css'
import '../styles/home.css'
import { Header } from './components/Header'
import { ThemeProvider } from './hooks/useTheme'

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Header />
      <main className="main-content">
        <section className="hero">
          <div className="hero-content">
            <h1 className="hero-title">Welcome to JustPlay</h1>
            <p className="hero-subtitle">
              Simple, reliable logistics for sports organizations of all sizes
            </p>
          </div>
        </section>

        <article className="content">
          <h2>Our Mission</h2>
          <p>
            JustPlay provides comprehensive sports logistics and league management tools for any sport.
            From organizing competitions and managing players to tracking statistics and coordinating spaces,
            we help sports organizations, clubs, and friend groups focus on what matters: the game.
          </p>

          <h2>What We Offer</h2>
          <ul className="feature-list">
            <li>
              <strong>Competition Management:</strong> Create and manage seasonal leagues, weekly leagues,
              day tournaments, and multi-day events.
            </li>
            <li>
              <strong>Player Lifecycle:</strong> Organize players into groups and subgroups with full
              registration and management.
            </li>
            <li>
              <strong>Statistics Tracking:</strong> Record and analyze player performance across matches
              and seasons.
            </li>
            <li>
              <strong>Space Management:</strong> Manage venues, courts, and availability with ease.
            </li>
            <li>
              <strong>Equipment Logistics:</strong> Track and assign equipment inventory efficiently.
            </li>
            <li>
              <strong>Payment Workflows:</strong> Streamline payments and reconciliation for leagues and
              tournaments.
            </li>
            <li>
              <strong>Secure Access:</strong> Social sign-in and multi-factor authentication for all members.
            </li>
          </ul>

          <h2>Getting Started</h2>
          <p>
            Whether you're organizing a casual volleyball league or a complex multi-sport tournament,
            JustPlay adapts to your needs. Sign in today to start managing your next event.
          </p>

          <p style={{ marginTop: '2rem', fontStyle: 'italic', opacity: 0.7 }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
            labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
            laboris nisi ut aliquip ex ea commodo consequat.
          </p>
        </article>

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
    </ThemeProvider>
  )
}

export default App
