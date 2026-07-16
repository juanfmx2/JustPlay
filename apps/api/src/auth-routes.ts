import { type FastifyInstance } from 'fastify'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './auth'

export const registerAuthRoutes = (app: FastifyInstance) => {
  const authHandler = toNodeHandler(auth)

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/auth/')) {
      return
    }

    reply.hijack()
    await authHandler(request.raw, reply.raw)
  })
}
