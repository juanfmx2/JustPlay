import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getRequestUrl } from '@tanstack/react-start/server'
import QRCode from 'qrcode'

import { getSecurityKeys } from '@/server/auth.server'

type DivisionsFile = Array<{
  division_name: string
  division_short: string
  teams: Array<{ team_name: string; captain: string }>
}>

export type LoginEntry = {
  name: string
  url: string
  qrSvg: string
  division?: string
}

function loadTeamDivisionMap(): Record<string, string> {
  const map: Record<string, string> = {}

  for (const file of ['men_divisions.json', 'mixed_divisions.json']) {
    const filePath = join(process.cwd(), 'data', file)
    const divisions: DivisionsFile = JSON.parse(readFileSync(filePath, 'utf-8'))

    for (const division of divisions) {
      for (const team of division.teams) {
        map[team.team_name] = division.division_name
      }
    }
  }

  return map
}

async function buildLoginEntry(name: string, token: string, origin: string, division?: string): Promise<LoginEntry> {
  const url = `${origin}/login?auth_token=${token}`
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 160 })
  return { name, url, qrSvg, division }
}

export async function loadLoginQrEntries(): Promise<{ admins: LoginEntry[]; teams: LoginEntry[] }> {
  const origin = getRequestUrl().origin
  const keys = getSecurityKeys()
  const divisionMap = loadTeamDivisionMap()

  const admins = await Promise.all(
    Object.entries(keys.admin).map(([name, token]) => buildLoginEntry(name, token, origin)),
  )

  const teams = await Promise.all(
    Object.entries(keys.teams).map(([name, token]) =>
      buildLoginEntry(name, token, origin, divisionMap[name] ?? 'Unassigned'),
    ),
  )

  return { admins, teams }
}
