import { buildApp } from './app'
import { registerAuthRoutes } from './auth-routes'

const fastify = buildApp()
registerAuthRoutes(fastify)

const start = async () => {
  try {
    await fastify.listen({ port: 4000, host: '0.0.0.0' })
    console.log('Server listening on http://localhost:4000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
