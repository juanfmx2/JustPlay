import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

type User = {
  id: number
  name: string
  lastname: string
  phoneNumber: string
  email: string
}

type UserForm = {
  name: string
  lastname: string
  phoneNumber: string
  email: string
}

const INITIAL_USERS: User[] = [
  {
    id: 1,
    name: 'Alex',
    lastname: 'Rivera',
    phoneNumber: '+1 555-0100',
    email: 'alex@justplay.local',
  },
]

const EMPTY_FORM: UserForm = {
  name: '',
  lastname: '',
  phoneNumber: '',
  email: '',
}

export const Route = createFileRoute('/admin/users')({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)

  const nextId = useMemo(() => {
    if (users.length === 0) {
      return 1
    }

    return Math.max(...users.map((user) => user.id)) + 1
  }, [users])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (
      !form.name.trim() ||
      !form.lastname.trim() ||
      !form.phoneNumber.trim() ||
      !form.email.trim()
    ) {
      return
    }

    if (editingId !== null) {
      setUsers((current) =>
        current.map((user) =>
          user.id === editingId ? { ...user, ...form } : user,
        ),
      )
      resetForm()
      return
    }

    setUsers((current) => [
      ...current,
      {
        id: nextId,
        ...form,
      },
    ])
    resetForm()
  }

  const onEdit = (user: User) => {
    setEditingId(user.id)
    setForm({
      name: user.name,
      lastname: user.lastname,
      phoneNumber: user.phoneNumber,
      email: user.email,
    })
  }

  const onDelete = (userId: number) => {
    setUsers((current) => current.filter((user) => user.id !== userId))

    if (editingId === userId) {
      resetForm()
    }
  }

  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">Admin Users</h1>
        <p className="text-body-secondary mb-0">
          View, add, and edit users at <code>/admin/users</code>.
        </p>
      </header>

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="h5 mb-3">{editingId ? 'Edit User' : 'Add User'}</h2>

              <form onSubmit={onSubmit} className="d-flex flex-column gap-3">
                <div>
                  <label htmlFor="userName" className="form-label">
                    First name
                  </label>
                  <input
                    id="userName"
                    className="form-control"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                  />
                </div>

                <div>
                  <label htmlFor="userLastname" className="form-label">
                    Last name
                  </label>
                  <input
                    id="userLastname"
                    className="form-control"
                    value={form.lastname}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, lastname: event.target.value }))
                    }
                    required
                  />
                </div>

                <div>
                  <label htmlFor="userPhone" className="form-label">
                    Phone number
                  </label>
                  <input
                    id="userPhone"
                    className="form-control"
                    value={form.phoneNumber}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phoneNumber: event.target.value }))
                    }
                    required
                  />
                </div>

                <div>
                  <label htmlFor="userEmail" className="form-label">
                    Email
                  </label>
                  <input
                    id="userEmail"
                    className="form-control"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    required
                  />
                </div>

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-banana">
                    {editingId ? 'Update' : 'Add'} User
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
              <h2 className="h5 mb-3">Users</h2>

              {users.length === 0 ? (
                <p className="text-body-secondary mb-0">No users added yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">First name</th>
                        <th scope="col">Last name</th>
                        <th scope="col">Phone</th>
                        <th scope="col">Email</th>
                        <th scope="col" className="text-end">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.lastname}</td>
                          <td>{user.phoneNumber}</td>
                          <td>{user.email}</td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => onEdit(user)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => onDelete(user.id)}
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
