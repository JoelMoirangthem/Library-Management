import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BRAND } from '../src/lib/brand.ts'

/** Every source file that can reach a screen, a tab title, a UPI payment note or an email. */
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('brand', () => {
  it('is NearMe Library', () => {
    expect(BRAND.name).toBe('NearMe Library')
  })

  it('has a UPI payee name that is short and plain (banks show it on the payment screen)', () => {
    expect(BRAND.upiPayeeName).toBe('NearMe Library')
    expect(BRAND.upiPayeeName.length).toBeLessThanOrEqual(30)
  })

  it('no screen text, title or payment note still says StudySeat or Study Seat', () => {
    // The capitalised product name only. Lower-case identifiers (storage keys, the admin sign-in domain) are internal and stay.
    const offenders = sourceFiles('src').filter((f) => /Study ?Seat/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('index.html (tab title and link previews) does not say StudySeat either', () => {
    expect(/Study ?Seat/.test(readFileSync('index.html', 'utf8'))).toBe(false)
  })
})