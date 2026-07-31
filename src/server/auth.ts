import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getSession, updateSession, clearSession, type SessionConfig } from '@tanstack/react-start/server'

export type AuthPrincipal =
  | { type: 'admin'; name: string }
  | { type: 'team'; name: string }

type SecurityKeysFile = {
  admin: Record<string, string>
  teams: Record<string, string>
}

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required for token authentication.')
}

export const sessionConfig: SessionConfig = {
  password: process.env.SESSION_SECRET,
  name: 'justplay_session',
  maxAge: 60 * 60 * 24 * 30,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
}

export function findPrincipalByToken(token: string): AuthPrincipal | null {
  if (!token) return null

  const filePath = join(process.cwd(), 'data', 'security-keys.json')
  const keys: SecurityKeysFile = JSON.parse(readFileSync(filePath, 'utf-8'))

  for (const [name, value] of Object.entries(keys.admin)) {
    if (value === token) return { type: 'admin', name }
  }

  for (const [name, value] of Object.entries(keys.teams)) {
    if (value === token) return { type: 'team', name }
  }

  return null
}

export async function getSessionPrincipal(): Promise<AuthPrincipal | null> {
  const session = await getSession<AuthPrincipal>(sessionConfig)
  const { type, name } = session.data

  if ((type === 'admin' || type === 'team') && typeof name === 'string') {
    return { type, name }
  }

  return null
}

export async function setSessionPrincipal(principal: AuthPrincipal): Promise<void> {
  await updateSession<AuthPrincipal>(sessionConfig, principal)
}

export async function clearSessionPrincipal(): Promise<void> {
  await clearSession(sessionConfig)
}
