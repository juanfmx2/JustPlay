import { eq } from 'drizzle-orm'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { db } from '../../../db/client'
import { organizations } from '../../../schema'

const loadOrganizationBySlug = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    return db.query.organizations.findFirst({
      where: eq(organizations.urlSlug, slug),
      with: {
        competitions: {
          orderBy: (competition, { asc }) => [asc(competition.id)],
        },
      },
    })
  })

export const Route = createFileRoute('/org/$orgUrlSlug/')({
  loader: async ({ params }) => {
    return loadOrganizationBySlug({ data: params.orgUrlSlug })
  },
  component: OrganizationPage,
})

function OrganizationPage() {
  const organization = Route.useLoaderData()

  if (!organization) {
    return (
      <section className="container py-4">
        <h1 className="h3 mb-2">Organization not found</h1>
        <p className="text-body-secondary mb-0">
          No organization exists for this slug.
        </p>
      </section>
    )
  }

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">{organization.name}</h1>
        <p className="text-body-secondary mb-1">/{organization.urlSlug}</p>
        <p className="mb-0">{organization.description}</p>
      </header>

      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="h5 mb-3">Competitions</h2>

          {organization.competitions.length === 0 ? (
            <p className="text-body-secondary mb-0">No competitions found for this organization.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Type</th>
                    <th scope="col">Format</th>
                  </tr>
                </thead>
                <tbody>
                  {organization.competitions.map((competition) => (
                    <tr key={competition.id}>
                      <td>
                        {competition.urlSlug ? (
                          <Link
                            to="/org/$orgUrlSlug/competition/$competitionUrlSlug"
                            params={{
                              orgUrlSlug: organization.urlSlug,
                              competitionUrlSlug: competition.urlSlug,
                            }}
                          >
                            {competition.name}
                          </Link>
                        ) : (
                          <span>{competition.name}</span>
                        )}
                      </td>
                      <td>{competition.urlSlug ?? '-'}</td>
                      <td>{competition.type}</td>
                      <td>{competition.format}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}