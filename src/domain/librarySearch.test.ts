import { describe, expect, it } from 'vitest'
import { matchesLibrarySearch } from '@/domain/librarySearch'

const lib = {
  name: 'Xyz Study Hub',
  areaName: 'Gomti Nagar',
  cityName: 'Lucknow',
  landmark: 'Near Patrakarpuram crossing',
  address: '12 Vibhuti Khand',
  pincode: '226010',
}

describe('matchesLibrarySearch (what a student can type in the search box)', () => {
  it('an empty or blank search matches everything', () => {
    expect(matchesLibrarySearch(lib, '')).toBe(true)
    expect(matchesLibrarySearch(lib, '   ')).toBe(true)
  })

  it.each([
    ['name', 'xyz'],
    ['area', 'gomti'],
    ['city', 'Lucknow'],
    ['landmark', 'patrakarpuram'],
    ['address', 'vibhuti'],
    ['pincode', '226010'],
  ])('finds a library by its %s', (_field, text) => {
    expect(matchesLibrarySearch(lib, text)).toBe(true)
  })

  it('ignores capital letters and extra spaces', () => {
    expect(matchesLibrarySearch(lib, '  GOMTI    nagar ')).toBe(true)
  })

  it('every word must match, but the words may come from different fields', () => {
    expect(matchesLibrarySearch(lib, 'xyz lucknow')).toBe(true)
    expect(matchesLibrarySearch(lib, 'gomti nagar lucknow')).toBe(true)
    expect(matchesLibrarySearch(lib, 'lucknow 226010')).toBe(true)
  })

  it('a word that matches nothing rules the library out', () => {
    expect(matchesLibrarySearch(lib, 'xyz delhi')).toBe(false)
    expect(matchesLibrarySearch(lib, 'zzz')).toBe(false)
  })

  it('matches part of a word, so a student does not have to finish typing', () => {
    expect(matchesLibrarySearch(lib, 'luck')).toBe(true)
  })

  it('does not treat typed symbols as anything special', () => {
    expect(matchesLibrarySearch(lib, '.*')).toBe(false)
    expect(matchesLibrarySearch(lib, '(')).toBe(false)
  })

  it('copes with a library that has an empty landmark or address', () => {
    expect(matchesLibrarySearch({ ...lib, landmark: '', address: '' }, 'lucknow')).toBe(true)
  })
})