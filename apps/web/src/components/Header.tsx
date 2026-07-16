import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthSession } from '../hooks/useAuthSession'
import { useTheme } from '../hooks/useTheme'
import '../styles/header.css'

export const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { theme, setTheme } = useTheme()
  const { isLoading, user, signOut } = useAuthSession()

  const onSignOut = async () => {
    setIsSigningOut(true)
    await signOut()
    setMenuOpen(false)
    setIsSigningOut(false)
  }

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo-section">
          <div className="logo">JP</div>
          <h1 className="brand-name">JustPlay</h1>
        </div>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav className={`nav-menu ${menuOpen ? 'open' : ''}`}>
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link nav-link-active' }}
            activeOptions={{ exact: true }}
            onClick={() => setMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            to="/about"
            className="nav-link"
            activeProps={{ className: 'nav-link nav-link-active' }}
            onClick={() => setMenuOpen(false)}
          >
            About
          </Link>
          <Link
            to="/leagues"
            className="nav-link"
            activeProps={{ className: 'nav-link nav-link-active' }}
            onClick={() => setMenuOpen(false)}
          >
            Leagues
          </Link>
          {isLoading ? <span className="nav-auth-status">Checking session...</span> : null}
          {!isLoading && user ? (
            <>
              <span className="nav-auth-status">Signed in as {user.name || user.email}</span>
              <button className="nav-signout" type="button" onClick={onSignOut} disabled={isSigningOut}>
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </>
          ) : null}
          {!isLoading && !user ? (
            <Link
              to="/sign-in"
              className="nav-link"
              activeProps={{ className: 'nav-link nav-link-active' }}
              onClick={() => setMenuOpen(false)}
            >
              Sign In
            </Link>
          ) : null}
        </nav>

        <div className="theme-selector">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            aria-label="Select theme"
            className="theme-select"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>
    </header>
  )
}
