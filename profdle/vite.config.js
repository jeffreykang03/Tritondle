import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Local dev / preview always use `/` so http://localhost:5173 works.
 * GitHub Pages project sites set `GH_PAGES=1` + `BASE_PATH=<repo>` in CI only.
 */
function resolveBase() {
  if (process.env.GH_PAGES !== '1') return '/'
  const raw = (process.env.BASE_PATH || '').trim()
  if (!raw) return '/'
  const slug = raw.replace(/^\/+|\/+$/g, '')
  if (!slug) return '/'
  return `/${slug}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
})
