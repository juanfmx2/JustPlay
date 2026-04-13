import { and, eq } from 'drizzle-orm'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '../../../../../db/client'
import { competitions, organizations } from '../../../../../schema'

const loadCompetitionRules = createServerFn({ method: 'GET' })
  .inputValidator((input: { orgUrlSlug: string; competitionUrlSlug: string }) => input)
  .handler(async ({ data }) => {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, data.orgUrlSlug),
    })

    if (!organization) return null

    const competition = await db.query.competitions.findFirst({
      where: and(
        eq(competitions.organizationId, organization.id),
        eq(competitions.urlSlug, data.competitionUrlSlug),
      ),
      with: {
        ruleGroups: {
          orderBy: (group, { asc }) => [asc(group.id)],
          with: {
            rules: {
              orderBy: (rule, { asc }) => [asc(rule.id)],
            },
          },
        },
      },
    })

    return {
      organization,
      competition,
    }
  })

export const Route = createFileRoute('/org/$orgUrlSlug/competition/$competitionUrlSlug/rules')({
  loader: async ({ params }) => {
    return loadCompetitionRules({
      data: {
        orgUrlSlug: params.orgUrlSlug,
        competitionUrlSlug: params.competitionUrlSlug,
      },
    })
  },
  component: CompetitionRulesPage,
})

function CompetitionRulesPage() {
  const data = Route.useLoaderData()

  if (!data) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Organization not found</h1>
        <p className="text-body-secondary mb-0">No organization exists for this slug.</p>
      </section>
    )
  }

  if (!data.competition) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Competition not found</h1>
        <p className="text-body-secondary mb-0">
          No competition exists for this slug under {data.organization.name}.
        </p>
      </section>
    )
  }

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <h1 className="h2 mb-1">{data.competition.name} - Rules</h1>
        </div>
        <Link
          className="btn btn-outline-secondary"
          to="/org/$orgUrlSlug/competition/$competitionUrlSlug"
          params={{
            orgUrlSlug: data.organization.urlSlug,
            competitionUrlSlug: data.competition.urlSlug ?? '',
          }}
        >
          Back to Competition
        </Link>
      </header>

      {data.competition.ruleGroups.length === 0 ? (
        <p className="text-body-secondary mb-0">No rules have been loaded for this competition yet.</p>
      ) : (
        <div className="row g-3 g-lg-4 row-cols-1 row-cols-lg-2">
          {data.competition.ruleGroups.map((group) => (
            <div className="col" key={group.id}>
              <article className="card h-100 shadow-sm">
                <div className="card-body">
                  <header className="mb-3">
                    <h2 className="h5 mb-1">{group.title}</h2>
                    <p className="text-body-secondary mb-0">{group.description}</p>
                  </header>

                  {group.rules.length === 0 ? (
                    <p className="text-body-secondary mb-0">No rules in this group yet.</p>
                  ) : (
                    <ol className="ps-3 mb-0 d-flex flex-column gap-2">
                      {group.rules.map((rule) => (
                        <li key={rule.id}>
                          <div dangerouslySetInnerHTML={{ __html: rule.html }} />
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}