
import { useContext } from 'react'
import { ThemeContext, getThemeLabelComponent } from '../hooks/ThemeContext'

export function NavBar() {
    const { theme, toggleTheme } = useContext(ThemeContext)

    return (
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

            {/* Search bar + theme toggle */}
            <div className="d-flex flex-column flex-lg-row gap-2 align-items-stretch align-items-lg-center">
                <button
                className="btn btn-banana theme-toggle"
                type="button"
                onClick={toggleTheme}
                >
                {getThemeLabelComponent(theme)}
                </button>

                <form className="d-flex" role="search">
                <input
                className="form-control me-2"
                type="search"
                placeholder="Search..."
                aria-label="Search"
                />
                <button className="btn btn-banana" type="submit">
                Search
                </button>
                </form>
            </div>
            </div>
        </div>
    </nav>
    )
}