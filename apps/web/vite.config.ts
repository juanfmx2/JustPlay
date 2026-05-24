import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@justplay/db': path.resolve(__dirname, '../../packages/db/src'),
      '@justplay/gql': path.resolve(__dirname, '../../packages/gql/src'),
      '@justplay/auth': path.resolve(__dirname, '../../packages/auth/src'),
    },
  },
  server: {
    port: 3000,
    strictPort: false,
  },
  build: {
    target: 'ES2020',
    sourcemap: true,
  },
})
