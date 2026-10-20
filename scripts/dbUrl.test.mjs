import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDbUrl, DEFAULT_DB_HOST, maskSecret, projectRefFromUrl, quoteForCmd } from './dbUrl.mjs'

describe('projectRefFromUrl', () => {
  it('reads the project id out of the Supabase address in .env', () => {
    expect(projectRefFromUrl('https://abcdefghijklmnopqrst.supabase.co')).toBe('abcdefghijklmnopqrst')
    expect(projectRefFromUrl(' https://abcdefghijklmnopqrst.supabase.co/ ')).toBe('abcdefghijklmnopqrst')
  })

  it('refuses anything that is not a Supabase project address', () => {
    expect(() => projectRefFromUrl('')).toThrow(/VITE_SUPABASE_URL/)
    expect(() => projectRefFromUrl('https://example.com')).toThrow(/VITE_SUPABASE_URL/)
    expect(() => projectRefFromUrl(undefined)).toThrow(/VITE_SUPABASE_URL/)
  })
})

describe('buildDbUrl (the password is typed as plain text; special characters are encoded here)', () => {
  const env = { VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_DB_PASSWORD: 'p@ss:w/o#rd?%&=+ x' }

  it('encodes every character that would break a connection address', () => {
    const url = buildDbUrl(env)
    expect(url).toBe(`postgresql://postgres.abcdefghijklmnopqrst:p%40ss%3Aw%2Fo%23rd%3F%25%26%3D%2B%20x@${DEFAULT_DB_HOST}:5432/postgres`)
    expect(new URL(url).password).toBe('p%40ss%3Aw%2Fo%23rd%3F%25%26%3D%2B%20x')
    expect(decodeURIComponent(new URL(url).password)).toBe(env.SUPABASE_DB_PASSWORD)
  })

  it('keeps a plain password unchanged', () => {
    expect(buildDbUrl({ ...env, SUPABASE_DB_PASSWORD: 'Abc12345xyz' })).toContain(':Abc12345xyz@')
  })

  it('uses SUPABASE_DB_HOST when the project is in another region', () => {
    expect(buildDbUrl({ ...env, SUPABASE_DB_HOST: 'aws-0-us-east-1.pooler.supabase.com' })).toContain('@aws-0-us-east-1.pooler.supabase.com:5432/')
  })

  it('stops with a clear message when the password is missing or blank', () => {
    expect(() => buildDbUrl({ VITE_SUPABASE_URL: env.VITE_SUPABASE_URL })).toThrow(/SUPABASE_DB_PASSWORD/)
    expect(() => buildDbUrl({ ...env, SUPABASE_DB_PASSWORD: '   ' })).toThrow(/SUPABASE_DB_PASSWORD/)
  })

  it('stops when the host looks like a web address instead of a host name', () => {
    expect(() => buildDbUrl({ ...env, SUPABASE_DB_HOST: 'https://x.supabase.com' })).toThrow(/SUPABASE_DB_HOST/)
  })
})

describe('maskSecret (output of the tool must never show the password)', () => {
  it('hides the password in both its plain and encoded forms', () => {
    const pw = 'p@ss:w/rd'
    const text = `error for postgresql://u:${encodeURIComponent(pw)}@h and also ${pw}`
    const masked = maskSecret(text, pw)
    expect(masked).not.toContain(pw)
    expect(masked).not.toContain(encodeURIComponent(pw))
    expect(masked).toContain('****')
  })

  it('leaves text alone when there is no secret', () => {
    expect(maskSecret('hello', '')).toBe('hello')
  })
})

describe('quoteForCmd (the Windows command shell splits unquoted text at spaces, which broke SQL passed to the CLI)', () => {
  it('wraps an argument that has spaces so it stays one argument', () => {
    expect(quoteForCmd('select 1 as x')).toBe('"select 1 as x"')
  })

  it('keeps a plain word working too', () => {
    expect(quoteForCmd('push')).toBe('"push"')
  })

  it('escapes a double quote inside the text', () => {
    expect(quoteForCmd('select "Name" from t')).toBe('"select \\"Name\\" from t"')
  })

  it('keeps characters the shell treats as special inside the quotes', () => {
    expect(quoteForCmd("select 'a' || 'b' & more")).toBe(`"select 'a' || 'b' & more"`)
  })

  it('doubles a trailing backslash so it cannot swallow the closing quote', () => {
    expect(quoteForCmd('C:\\dir\\')).toBe('"C:\\dir\\\\"')
  })
})

describe('the database password stays out of the hosting config', () => {
  it('render.yaml never mentions the admin-tool variables', () => {
    const yaml = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8')
    expect(yaml).not.toMatch(/SUPABASE_DB_/)
    expect(yaml).not.toMatch(/service_role/i)
  })

  it('.env.example lists the password name with no value filled in', () => {
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
    expect(example).toMatch(/^SUPABASE_DB_PASSWORD=\s*$/m)
    expect(example).toMatch(/^SUPABASE_DB_HOST=\s*$/m)
  })
})
