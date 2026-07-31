import { useTheme, getThemeLabelComponent } from '../hooks/ThemeContext'
import type { MouseEvent } from 'react'
import type { AuthPrincipal } from '@/server/auth'

type NavBarProps = {
    readonly principal: AuthPrincipal | null
    readonly teamLatestScheduleHref: string | null
}

export function NavBar({ principal, teamLatestScheduleHref }: NavBarProps) {
    const { theme, toggleTheme } = useTheme()

    const confirmLogout = (event: MouseEvent<HTMLAnchorElement>) => {
        const confirmed = window.confirm('Are you sure you want to log out?')
        if (!confirmed) {
            event.preventDefault()
        }
    }

    return (
    <div className="sticky-top no-print shadow-sm">
    <nav className="navbar navbar-expand-lg bg-body-tertiary">
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

    {principal ? (
    <div className="navbar-user-subnav" role="region" aria-label="Session information">
        <div className="container-fluid navbar-user-subnav-inner">
            <div className="navbar-user-summary">
                <span className="navbar-user-label">Logged in as</span>
                <span className="navbar-user-name">
                    {principal.type === 'admin' ? 'Admin' : 'Team'}: {principal.name}
                </span>
            </div>
            <div className="d-flex flex-wrap justify-content-end align-items-center gap-2">
                {principal.type === 'team' && teamLatestScheduleHref ? (
                <a className="btn btn-sm btn-outline-dark" href={teamLatestScheduleHref}>
                    My Schedule
                </a>
                ) : null}
                {principal.type === 'admin' ? (
                <a className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1" href="/admin/login-qr-codes" aria-label="Login QR Codes">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                    >
                        <path d="M1 1h5v5H1V1zm1 1v3h3V2H2zm8-1h5v5h-5V1zm1 1v3h3V2h-3zM1 10h5v5H1v-5zm1 1v3h3v-3H2zm6-4h1v1H8V7zm1 1h1v1H9V8zm2 0h1v1h-1V8zm2 0h1v1h-1V8zM8 9h1v1H8V9zm2 1h1v1h-1v-1zm1 1h1v1h-1v-1zm-3 1h1v1H8v-1zm1 1h1v1H9v-1zm3-1h1v1h-1v-1zm1 1h1v2h-2v-1h1v-1zm-3 1h1v1h-1v-1z" />
                    </svg>
                    QR
                </a>
                ) : null}
                <a className="btn btn-sm btn-outline-dark" href="/org/cvc/competition/cvc-grass-2026">
                    Competition
                </a>
                <a className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1" href="/logout" onClick={confirmLogout}>
                    <span aria-hidden="true">X</span>
                </a>
            </div>
        </div>
    </div>
    ) : null}
    </div>
    )
}