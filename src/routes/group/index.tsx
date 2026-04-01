import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/group/')({
  component: GroupHome,
})

function GroupHome() {
  return (
    <section className="container-fluid py-4">
      <div className="d-flex flex-column align-items-center justify-content-center gap-3 text-center">
        <h1 className="display-4">Welcome to the Volleyball League Tracker</h1> 
      </div>
    </section>
  )
}