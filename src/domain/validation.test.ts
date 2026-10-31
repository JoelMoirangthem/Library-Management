import { describe, expect, it } from 'vitest'
import type { LibraryInput } from '@/domain/types'
import { validateLibraryInput } from '@/domain/validation'

const valid = (over: Partial<LibraryInput> = {}): LibraryInput => ({
  name: 'Gyan Deep Study Hub',
  stateId: 'S9',
  districtId: 'D162',
  cityId: 'C249234',
  area: 'Gomti Nagar',
  address: '2nd Floor, Shanti Complex',
  landmark: '',
  pincode: '226010',
  phone: '9415000011',
  capacity: 20,
  timings: '8 am to 8 pm',
  amenities: [],
  photos: [],
  ...over,
})

describe('validateLibraryInput: the typed area', () => {
  it('accepts a typed area', () => {
    expect(validateLibraryInput(valid())).toEqual({})
  })

  it('the area is optional: empty or blank is fine', () => {
    expect(validateLibraryInput(valid({ area: '' }))).toEqual({})
    expect(validateLibraryInput(valid({ area: '    ' }))).toEqual({})
  })

  it('refuses an area longer than 60 characters', () => {
    const errors = validateLibraryInput(valid({ area: 'a'.repeat(61) }))
    expect(errors.area).toMatch(/60/)
  })

  it('counts the length after tidying, so extra spaces do not push it over', () => {
    const spaced = `${'a'.repeat(30)}${' '.repeat(40)}${'b'.repeat(29)}` // 99 characters raw, 60 once tidied
    expect(validateLibraryInput(valid({ area: spaced }))).toEqual({})
  })
})
