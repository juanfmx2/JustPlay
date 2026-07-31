import { useTheme, getThemeLabelComponent } from '../hooks/ThemeContext'
import type { AuthPrincipal } from '@/server/auth'

type NavBarProps = {
    readonly principal: AuthPrincipal | null
}

export function NavBar({ principal }: NavBarProps) {
    const { theme, toggleTheme } = useTheme()

    return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary sticky-top shadow-sm no-print">
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

            {/* Session info: kept outside the collapsible menu so it's always visible, even on small screens */}
            {principal ? (
            <div className="d-flex align-items-center gap-2 order-lg-3">
                <span className="navbar-text mb-0 small">
                Logged in as {principal.type === 'admin' ? 'Admin' : 'Team'}:<br/> {principal.name}
                </span>
                <a className="btn btn-sm btn-outline-secondary" href="/logout">
                Logout
                </a>
            </div>
            ) : null}

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
                <a className="nav-link" href="/org/cvc/competition/cvc-grass-2026">
                    CVC Grass
                </a>
                </li>
            </ul>

            {/* Theme toggle */}
            <div className="d-flex flex-column flex-lg-row gap-2 align-items-stretch align-items-lg-center">
                <button
                className="btn btn-banana theme-toggle"
                type="button"
                onClick={toggleTheme}
                >
                {getThemeLabelComponent(theme)}
                </button>
{/* 
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
                </form> */}
            </div>
            </div>
        </div>
    </nav>
    )
}