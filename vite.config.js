import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { onRequestPost as handleAdminAuthUser } from './functions/api/admin-auth-user.js'
import { onRequestPost as handleR2Upload } from './functions/api/r2-upload.js'
import { onRequestGet as handleOrderGet, onRequestPost as handleOrderPost } from './functions/api/order.js'
import { onRequestPost as handleTableCallPost } from './functions/api/table-call.js'
import { onRequestPost as handleTelegramPost } from './functions/api/telegram.js'

const apiRoutes = {
  '/api/admin-auth-user': { POST: handleAdminAuthUser },
  '/api/r2-upload': { POST: handleR2Upload },
  '/api/order': { GET: handleOrderGet, POST: handleOrderPost },
  '/api/table-call': { POST: handleTableCallPost },
  '/api/telegram': { POST: handleTelegramPost },
}

function localPagesApiPlugin(env) {
  return {
    name: 'local-pages-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const routePath = Object.keys(apiRoutes).find((path) => url.startsWith(path))
        const handler = routePath ? apiRoutes[routePath]?.[req.method || 'GET'] : null
        if (!handler) {
          next()
          return
        }

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) headers.set(key, value.join(','))
            else if (value != null) headers.set(key, String(value))
          }

          const request = new Request(`http://${req.headers.host || 'localhost'}${url}`, {
            method: req.method,
            headers,
            body,
            duplex: body ? 'half' : undefined
          })

          const response = await handler({
            request,
            env: {
              SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
              TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
              TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
              R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
              R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
              R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
              R2_BUCKET_NAME: env.R2_BUCKET_NAME,
              R2_PUBLIC_URL: env.R2_PUBLIC_URL
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
