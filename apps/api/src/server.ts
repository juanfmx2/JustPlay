import { buildApp } from './app'

const fastify = buildApp()

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
