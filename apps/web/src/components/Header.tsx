import React, { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import '../styles/header.css'

export const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()

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
          <a href="/" className="nav-link">Home</a>
          <a href="/" className="nav-link">About</a>
          <a href="/" className="nav-link">Leagues</a>
          <a href="/" className="nav-link">Sign In</a>
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
