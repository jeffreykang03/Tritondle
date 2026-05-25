import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages project sites use `https://<user>.github.io/<repo>/`.
 * CI sets `BASE_PATH` to the repo name (no slashes). Local dev: unset → `/`.
 *
 * For a `username.github.io` user site (served from domain root), leave `BASE_PATH` unset in CI
 * or override in the workflow.
 */
function resolveBase() {
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
