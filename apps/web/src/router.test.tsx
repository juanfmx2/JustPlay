import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { createAppRouter } from './router'

describe('router', () => {
  it('renders the about page content at /about', async () => {
    const history = createMemoryHistory({ initialEntries: ['/about'] })
    const testRouter = createAppRouter(history)

    render(<RouterProvider router={testRouter} />)

    expect(await screen.findByRole('heading', { name: 'About JustPlay' })).toBeInTheDocument()
  })
})
