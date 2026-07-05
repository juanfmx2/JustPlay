import { buildApp } from './app'

describe('health endpoint', () => {
  it('returns an OK health payload', async () => {
    const app = buildApp()

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)

    const payload = response.json() as { status: string; timestamp: string }
    expect(payload.status).toBe('ok')
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false)

    await app.close()
  })
})
