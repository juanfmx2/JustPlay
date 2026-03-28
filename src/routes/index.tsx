import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <section className="container-fluid py-4">
      <div className="d-flex flex-column align-items-center justify-content-center gap-3 text-center">
        <img
          src="/img/banana.png"
          alt="Banana"
          className="img-fluid"
          style={{ maxWidth: '420px', width: '100%', height: 'auto' }}
        />
      </div>
    </section>
  )
}