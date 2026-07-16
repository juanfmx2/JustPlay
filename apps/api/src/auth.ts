import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'

const memoryStore: Record<string, any[]> = {
  user: [],
  account: [],
  session: [],
  verification: [],
}
const googleClientId = process.env.BETTER_AUTH_GOOGLE_CLIENT_ID
const googleClientSecret = process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET
const trustedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map((origin) => origin.trim())
    : []),
].filter(Boolean)

export const auth = betterAuth({
  database: memoryAdapter(memoryStore),
  emailAndPassword: {
    enabled: true,
  },
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
  secret: process.env.BETTER_AUTH_SECRET ?? 'justplay-infra-001-dev-secret',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
  trustedOrigins,
})
