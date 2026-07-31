import { createFileRoute } from '@tanstack/react-router'

import { COMPETITION_PATH } from '@/lib/routePaths'

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

        <p className="mb-3">You have found a happy BA NA NA!</p>
        <a className="btn btn-banana" href={COMPETITION_PATH}>
              Return to competition
        </a>
      </div>
    </section>
  )
}