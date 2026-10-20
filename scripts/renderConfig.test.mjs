import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Guards the hosting config: a careless edit of render.yaml that weakens security fails the tests (and CI).
const yaml = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8')

/** The value of a response header declared in render.yaml. */
function header(name) {
  const m = new RegExp(`name: ${name}\\s*\\n\\s*value: (.+)`, 'i').exec(yaml)
  return m ? m[1].trim().replace(/^"|"$/g, '') : null
}

describe('render.yaml: security headers', () => {
  const csp = header('Content-Security-Policy') ?? ''
  const directive = (n) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(n + ' ')) ?? '')

  it('has a Content-Security-Policy', () => {
    expect(csp).not.toBe('')
  })

  it('runs scripts only from the site itself: no inline code, no eval, no outside hosts', () => {
    expect(directive('script-src')).toBe("script-src 'self'")
    expect(csp).not.toMatch(/unsafe-eval/)
  })

  it('cannot be put inside someone else\'s page, and keeps the other protective directives', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('form-action')).toBe("form-action 'self'")
    expect(csp).toMatch(/upgrade-insecure-requests/)
  })

  it('talks only to its own site and Supabase', () => {
    expect(directive('connect-src')).toBe("connect-src 'self' https://*.supabase.co wss://*.supabase.co")
    expect(directive('img-src')).toBe("img-src 'self' data: blob: https://*.supabase.co")
    expect(directive('default-src')).toBe("default-src 'self'")
  })

  it('sends the standard hardening headers', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff')
    expect(header('X-Frame-Options')).toBe('DENY')
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(header('Strict-Transport-Security')).toMatch(/^max-age=\d{8,}$/)
    expect(header('Permissions-Policy')).toMatch(/camera=\(\)/)
  })
})

describe('render.yaml: build and secrets', () => {
  it('rewrites unknown paths to the app so a page refresh works', () => {
    expect(yaml).toMatch(/type: rewrite\s*\n\s*source: \/\*\s*\n\s*destination: \/index\.html/)
  })

  it('asks for the three site values in the dashboard instead of storing them in git', () => {
    for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_UPI_ID']) {
      expect(yaml).toMatch(new RegExp(`key: ${key}\\s*\\n\\s*sync: false`))
    }
  })

  it('deploys the main branch from the publish folder dist', () => {
    expect(yaml).toMatch(/branch: main/)
    expect(yaml).toMatch(/staticPublishPath: \.\/dist/)
    expect(yaml).toMatch(/buildCommand: npm ci && npm run build/)
  })
})