import Fastify, { type FastifyInstance } from 'fastify'

export const buildApp = (): FastifyInstance => {
  const app = Fastify({
    logger: true,
  })

  app.get('/health', async (_request, _reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  return app
}
