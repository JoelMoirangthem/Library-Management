import { describe, expect, it } from 'vitest'
import { areaKey, cleanArea, MAX_AREA_LENGTH, mergeAreaNames, sameArea } from '@/domain/areas'

describe('cleanArea', () => {
  it('trims and collapses inner spaces', () => {
    expect(cleanArea('  Gomti   Nagar ')).toBe('Gomti Nagar')
  })

  it('treats tabs and line breaks as spaces', () => {
    expect(cleanArea('Gomti\tNagar\n')).toBe('Gomti Nagar')
  })

  it('returns an empty string for blank input', () => {
    expect(cleanArea('   ')).toBe('')
  })
})

describe('areaKey and sameArea', () => {
  it('ignores case and extra spaces', () => {
    expect(areaKey(' gomti  NAGAR')).toBe('gomti nagar')
    expect(sameArea('Gomti Nagar', 'gomti  nagar ')).toBe(true)
    expect(sameArea('Gomti Nagar', 'Aliganj')).toBe(false)
  })

  it('does not match two blank areas to each other', () => {
    expect(sameArea('', '  ')).toBe(false)
  })
})

describe('mergeAreaNames', () => {
  it('removes duplicates, keeps the first spelling, drops blanks and sorts', () => {
    expect(mergeAreaNames(['Aliganj', 'gomti nagar', 'Gomti Nagar', ' ', 'Aliganj '])).toEqual([
      'Aliganj',
      'gomti nagar',
    ])
  })
})

describe('MAX_AREA_LENGTH', () => {
  it('matches the limit the database enforces (libraries_area_tidy in migration 0016)', () => {
    expect(MAX_AREA_LENGTH).toBe(60)
  })
})
