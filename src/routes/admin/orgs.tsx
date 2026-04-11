import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/client'
import { organizations as organizationsTable } from '../../schema'

type Organization = {
  id: number
  name: string
  urlSlug: string
  description: string
  contactEmail: string
}

type OrganizationForm = {
  name: string
  urlSlug: string
  description: string
  contactEmail: string
}

const SLUG_BLACKLIST = new Set(['admin'])
const SLUG_PATTERN = /^[a-z0-9-]+$/

const slugifyOrganizationName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const EMPTY_FORM: OrganizationForm = {
  name: '',
  urlSlug: '',
  description: '',
  contactEmail: '',
}

const loadOrganizations = createServerFn({ method: 'GET' }).handler(async () => {
  return db.select().from(organizationsTable).orderBy(organizationsTable.id)
})

type NewOrganization = {
  name: string
  urlSlug: string
  description: string
  contactEmail: string
}

const insertOrganization = createServerFn({ method: 'POST' })
  .inputValidator((data: NewOrganization) => data)
  .handler(async ({ data }) => {
    const [created] = await db
      .insert(organizationsTable)
      .values(data)
      .returning()
    return created
  })

export const Route = createFileRoute('/admin/orgs')({
  loader: async () => await loadOrganizations(),
  component: AdminOrganizationsPage,
})

function AdminOrganizationsPage() {
  const loaderOrgs = Route.useLoaderData()
  const [organizations, setOrganizations] = useState<Organization[]>(loaderOrgs)
  const [form, setForm] = useState<OrganizationForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveError, setSaveError] = useState('')

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const normalizedSlug = form.urlSlug.trim().toLowerCase()

  const slugError = useMemo(() => {
    if (!normalizedSlug) {
      return 'Slug is required.'
    }

    if (!SLUG_PATTERN.test(normalizedSlug)) {
      return 'Slug can only contain lowercase letters, numbers, and dashes.'
    }

    if (SLUG_BLACKLIST.has(normalizedSlug)) {
      return 'This slug is reserved and cannot be used.'
    }

    const slugExists = organizations.some(
      (organization) => organization.urlSlug === normalizedSlug && organization.id !== editingId,
    )

    if (slugExists) {
      return 'Slug must be unique. This slug is already in use.'
    }

    return ''
  }, [editingId, normalizedSlug, organizations])

  const onNameChange = (name: string) => {
    setForm((current) => {
      const currentDerivedSlug = slugifyOrganizationName(current.name)
      const shouldSyncSlug = !current.urlSlug || current.urlSlug === currentDerivedSlug

      return {
        ...current,
        name,
        urlSlug: shouldSyncSlug ? slugifyOrganizationName(name) : current.urlSlug,
      }
    })
  }

  const onSlugChange = (slug: string) => {
    setForm((current) => ({
      ...current,
      urlSlug: slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-{2,}/g, '-'),
    }))
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (
      !form.name.trim() ||
      !form.description.trim() ||
      !form.contactEmail.trim() ||
      !normalizedSlug ||
      Boolean(slugError)
    ) {
      return
    }

    if (editingId !== null) {
      setOrganizations((current) =>
        current.map((org) =>
          org.id === editingId
            ? {
                ...org,
                ...form,
                urlSlug: normalizedSlug,
              }
            : org,
        ),
      )
      resetForm()
      return
    }

    setSaveError('')
    setIsSubmitting(true)
    try {
      const created = await insertOrganization({
        data: {
          name: form.name.trim(),
          urlSlug: normalizedSlug,
          description: form.description.trim(),
          contactEmail: form.contactEmail.trim(),
        },
      })
      setOrganizations((current) => [...current, created])
      resetForm()
    } catch {
      setSaveError('Could not save organization. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onEdit = (organization: Organization) => {
    setEditingId(organization.id)
    setForm({
      name: organization.name,
      urlSlug: organization.urlSlug,
      description: organization.description,
      contactEmail: organization.contactEmail,
    })
  }

  const onDelete = (organizationId: number) => {
    setOrganizations((current) => current.filter((org) => org.id !== organizationId))

    if (editingId === organizationId) {
      resetForm()
    }
  }

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">Admin Organizations</h1>
        <p className="text-body-secondary mb-0">
          View, add, and edit organizations at <code>/admin/orgs</code>.
        </p>
      </header>

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">{editingId ? 'Edit Organization' : 'Add Organization'}</h2>

              <form onSubmit={onSubmit} className="d-flex flex-column gap-3">
                <div>
                  <label htmlFor="orgName" className="form-label">
                    Name
                  </label>
                  <input
                    id="orgName"
                    className="form-control"
                    value={form.name}
                    onChange={(event) => onNameChange(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="orgSlug" className="form-label">
                    URL slug
                  </label>
                  <input
                    id="orgSlug"
                    className={`form-control${slugError ? ' is-invalid' : ''}`}
                    value={form.urlSlug}
                    onChange={(event) => onSlugChange(event.target.value)}
                    pattern="[a-z0-9-]+"
                    required
                  />
                  <div className="form-text">
                    Lowercase, numbers, and dashes only. Example: justplay-volleyball
                  </div>
                  {slugError ? <div className="invalid-feedback d-block">{slugError}</div> : null}
                </div>

                <div>
                  <label htmlFor="orgDescription" className="form-label">
                    Description
                  </label>
                  <textarea
                    id="orgDescription"
                    className="form-control"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="orgContactEmail" className="form-label">
                    Contact email
                  </label>
                  <input
                    id="orgContactEmail"
                    className="form-control"
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contactEmail: event.target.value }))
                    }
                    required
                  />
                </div>

                {saveError ? (
                  <div className="alert alert-danger py-2 mb-0">{saveError}</div>
                ) : null}
                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-banana"
                    disabled={Boolean(slugError) || isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : `${editingId ? 'Update' : 'Add'} Organization`}
                  </button>
                  {editingId ? (
                    <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">Organizations</h2>

              {organizations.length === 0 ? (
                <p className="text-body-secondary mb-0">No organizations added yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Slug</th>
                        <th scope="col">Description</th>
                        <th scope="col">Contact</th>
                        <th scope="col" className="text-end">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {organizations.map((organization) => (
                        <tr key={organization.id}>
                          <td>{organization.name}</td>
                          <td>{organization.urlSlug}</td>
                          <td>{organization.description}</td>
                          <td>{organization.contactEmail}</td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => onEdit(organization)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => onDelete(organization.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
