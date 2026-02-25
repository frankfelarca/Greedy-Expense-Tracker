import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'crypto'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const salt = env.VITE_ADMIN_SALT || ''
  const pass = env.VITE_ADMIN_PASS || ''
  const hash = createHash('sha256').update(salt + pass).digest('hex')

  return {
    plugins: [react()],
    define: {
      __ADMIN_HASH__: JSON.stringify(hash),
      __ADMIN_SALT__: JSON.stringify(salt),
    },
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./src/test/setup.js'],
    },
  }
})
