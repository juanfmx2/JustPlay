import Fastify from 'fastify'

const fastify = Fastify({
  logger: true,
})

fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

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
