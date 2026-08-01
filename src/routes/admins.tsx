import { and, eq } from 'drizzle-orm'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '@/db/client'
import { competitions, organizations, stages } from '@/schema'
import { requireAdminPrincipal } from '@/server/auth'
import { COMPETITION_PATH } from '@/lib/routePaths'

const DEFAULT_ORG_SLUG = 'cvc'
const DEFAULT_COMPETITION_SLUG = 'cvc-grass-2026'

type StageOption = {
  urlSlug: string
  name: string
}

type StagesData = {
  registrationStage: StageOption | null
  playStages: StageOption[]
}

const loadStages = createServerFn({ method: 'GET' }).handler(async (): Promise<StagesData> => {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.urlSlug, DEFAULT_ORG_SLUG),
  })
  if (!organization) return { registrationStage: null, playStages: [] }

  const competition = await db.query.competitions.findFirst({
    where: and(eq(competitions.organizationId, organization.id), eq(competitions.urlSlug, DEFAULT_COMPETITION_SLUG)),
  })
  if (!competition) return { registrationStage: null, playStages: [] }

  const allStages = await db.query.stages.findMany({
    where: eq(stages.competitionId, competition.id),
  })

  const toOption = (stage: (typeof allStages)[number]): StageOption | null =>
    stage.urlSlug ? { urlSlug: stage.urlSlug, name: stage.name } : null

  const registrationStageRow = allStages.find((stage) => stage.type === 'REGISTRATION')
  const registrationStage = registrationStageRow ? toOption(registrationStageRow) : null
  const playStages = allStages
    .filter((stage) => stage.type !== 'REGISTRATION')
    .map(toOption)
    .filter((stage): stage is StageOption => stage !== null)

  return { registrationStage, playStages }
})

export const Route = createFileRoute('/admins')({
  loader: async () => ({
    principal: await requireAdminPrincipal(),
    stages: await loadStages(),
  }),
  component: AdminsPage,
})

function AdminsPage() {
  const { principal, stages: stagesData } = Route.useLoaderData()

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">Admin Dashboard</h1>
        <p className="text-body-secondary mb-0">Welcome, {principal.name}.</p>
      </header>

      <div className="d-flex flex-wrap gap-2 mb-4">
        <a className="btn btn-banana" href={COMPETITION_PATH}>
          Go to Competition
        </a>
        <a className="btn btn-outline-secondary" href="/admin/login-qr-codes">
          Login QR Codes
        </a>
      </div>

      {stagesData.registrationStage || stagesData.playStages.length > 0 ? (
        <div>
          <h2 className="h5 mb-2">Stage Summaries</h2>
          <div className="d-flex flex-wrap gap-2">
            {stagesData.registrationStage ? (
              <Link
                className="btn btn-outline-secondary"
                to="/admin/org/$orgUrlSlug/comp/$compSlug/stg/$stageSlug"
                params={{
                  orgUrlSlug: DEFAULT_ORG_SLUG,
                  compSlug: DEFAULT_COMPETITION_SLUG,
                  stageSlug: stagesData.registrationStage.urlSlug,
                }}
              >
                {stagesData.registrationStage.name} - Team Logins
              </Link>
            ) : null}
            {stagesData.playStages.map((stage) => (
              <Link
                key={stage.urlSlug}
                className="btn btn-outline-secondary"
                to="/admin/org/$orgUrlSlug/comp/$compSlug/stg/$stageSlug"
                params={{
                  orgUrlSlug: DEFAULT_ORG_SLUG,
                  compSlug: DEFAULT_COMPETITION_SLUG,
                  stageSlug: stage.urlSlug,
                }}
              >
                {stage.name} - Stage Summary
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
