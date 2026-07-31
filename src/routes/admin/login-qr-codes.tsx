import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { requireAdminPrincipal } from '@/server/auth'
import { loadLoginQrEntries, type LoginEntry } from '@/server/loginQrCodes.server'
import { COMPETITION_PATH } from '@/lib/routePaths'

const loadLoginQrData = createServerFn({ method: 'GET' }).handler(async () => {
  return loadLoginQrEntries()
})

export const Route = createFileRoute('/admin/login-qr-codes')({
  loader: async () => {
    await requireAdminPrincipal()
    return loadLoginQrData()
  },
  component: LoginQrCodesPage,
})

function EntryCard({ entry }: { readonly entry: LoginEntry }) {
  const responsiveQrSvg = entry.qrSvg.replace(
    '<svg',
    '<svg style="width: 100%; height: auto; display: block;"',
  )

  return (
    <div className="col">
      <div className="card h-100 shadow-sm">
        <div className="card-body text-center d-flex flex-column align-items-center gap-2">
          <h2 className="h6 mb-0">{entry.name}</h2>
          {entry.division ? <span className="badge text-bg-secondary">{entry.division}</span> : null}
          <div className="w-100" style={{ maxWidth: '420px' }}>
            <div
              className="w-100"
              style={{ lineHeight: 0 }}
              dangerouslySetInnerHTML={{ __html: responsiveQrSvg }}
            />
          </div>
          <a className="small" href={entry.url}>
            Open login link
          </a>
        </div>
      </div>
    </div>
  )
}

function splitDivisionLabel(division: string | null | undefined): {
  mainDivision: string
  subPool: string
} {
  const value = (division ?? '').trim()
  if (!value) {
    return {
      mainDivision: 'Unassigned Division',
      subPool: 'Other',
    }
  }

  const match = value.match(/^(.*?)\s*-\s*(Pool\s+[A-Za-z0-9]+)$/i)
  if (!match) {
    return {
      mainDivision: value,
      subPool: 'Other',
    }
  }

  return {
    mainDivision: match[1].trim(),
    subPool: match[2].trim(),
  }
}

function LoginQrCodesPage() {
  const { admins, teams } = Route.useLoaderData()

  const groupedTeams = teams.reduce<
    Array<{
      mainDivision: string
      pools: Array<{
        subPool: string
        entries: LoginEntry[]
      }>
    }>
  >((groups, entry) => {
    const { mainDivision, subPool } = splitDivisionLabel(entry.division)
    let divisionGroup = groups.find((group) => group.mainDivision === mainDivision)

    if (!divisionGroup) {
      divisionGroup = {
        mainDivision,
        pools: [],
      }
      groups.push(divisionGroup)
    }

    let poolGroup = divisionGroup.pools.find((pool) => pool.subPool === subPool)
    if (!poolGroup) {
      poolGroup = {
        subPool,
        entries: [],
      }
      divisionGroup.pools.push(poolGroup)
    }

    poolGroup.entries.push(entry)
    return groups
  }, [])

  return (
    <section className="container-fluid container-md py-4">
      <header className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1 className="h2 mb-1">Login QR Codes</h1>
          <p className="text-body-secondary mb-0">Scan a code or share its link to log in as that admin or team.</p>
        </div>
        <a className="btn btn-outline-secondary" href={COMPETITION_PATH}>
          Back to Competition
        </a>
      </header>

      <details className="mb-4 border rounded p-3">
        <summary className="h4 mb-0" style={{ cursor: 'pointer' }}>
          Admins
        </summary>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3 mt-2">
          {admins.map((entry) => (
            <EntryCard key={entry.name} entry={entry} />
          ))}
        </div>
      </details>

      <h2 className="h4 mb-3">Teams</h2>
      <div className="d-flex flex-column gap-4">
        {groupedTeams.map((divisionGroup) => (
          <details key={divisionGroup.mainDivision} className="border rounded p-3">
            <summary className="h4 mb-0" style={{ cursor: 'pointer' }}>
              {divisionGroup.mainDivision}
            </summary>
            <div className="d-flex flex-column gap-3 mt-3">
              {divisionGroup.pools.map((poolGroup) => (
                <details key={`${divisionGroup.mainDivision}-${poolGroup.subPool}`} className="border rounded p-2">
                  <summary className="h5 mb-0" style={{ cursor: 'pointer' }}>
                    {poolGroup.subPool}
                  </summary>
                  <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3 mt-2">
                    {poolGroup.entries.map((entry) => (
                      <EntryCard key={entry.name} entry={entry} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
