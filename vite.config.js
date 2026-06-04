import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { onRequestPost as handleAdminAuthUser } from './functions/api/admin-auth-user.js'

function localPagesApiPlugin(env) {
  return {
    name: 'local-pages-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (req.method !== 'POST' || !url.startsWith('/api/admin-auth-user')) {
          next()
          return
        }

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const body = Buffer.concat(chunks).toString('utf8')
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) headers.set(key, value.join(','))
            else if (value != null) headers.set(key, String(value))
          }

          const request = new Request(`http://${req.headers.host || 'localhost'}${url}`, {
            method: 'POST',
            headers,
            body
          })

          const response = await handleAdminAuthUser({
            request,
            env: {
              SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY
            }
          })

          const arrayBuffer = await response.arrayBuffer()
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(arrayBuffer))
        } catch (error) {
          next(error)
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), localPagesApiPlugin(env)],
  }
})
