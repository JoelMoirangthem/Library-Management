import { describe, expect, it } from 'vitest'
import { cleanTownName, lowerJoiningWords, parseCsv, sqlText, titleCaseIfShouting } from './clean.mjs'

describe('cleanTownName', () => {
  it.each([
    ['Lucknow', 'Lucknow'],
    ['New Delhi Municipal Council', 'New Delhi'],
    ['Medininagar (Daltonganj) Municipal Corporation', 'Medininagar (Daltonganj)'],
    ['Municipal Council Desaiganj ( Wadsa)', 'Desaiganj (Wadsa)'],
    ['Bengaluru Central City Corporation(Gba)', 'Bengaluru Central'],
    ['Gangtok (M Corp.)', 'Gangtok'],
    ['Rangpo (Np)', 'Rangpo'],
    ['Dhone(M)', 'Dhone'],
    ['Shahpura..(Bhilwara)', 'Shahpura (Bhilwara)'],
    ['Rajgarh(Churu)', 'Rajgarh (Churu)'],
    ['KUSHESWAR ASTHAN EAST', 'Kusheswar Asthan East'],
    ['Hallikheda (B)', 'Hallikheda (B)'],
    ['Deoni (Bk)', 'Deoni (Bk)'],
    ['Greater Chennai Corporation', 'Greater Chennai'],
    ['Bilasipara Tc', 'Bilasipara'],
    ['Kokrajhar Mb', 'Kokrajhar'],
    ['Tura Municipal Board', 'Tura'],
    ['Aboi Town Council', 'Aboi'],
    ['Moran Town', 'Moran Town'],
    ['City Corporation Panaji', 'Panaji'],
    ['Nagar Palika, Nainpur', 'Nainpur'],
    ['Anuppur Np', 'Anuppur'],
    ['Hindaun City', 'Hindaun City'],
  ])('%s -> %s', (raw, clean) => {
    expect(cleanTownName(raw)).toBe(clean)
  })
})

describe('name casing', () => {
  it('title-cases only all-capital names', () => {
    expect(titleCaseIfShouting('AMDABAD')).toBe('Amdabad')
    expect(titleCaseIfShouting('McLeod Ganj')).toBe('McLeod Ganj')
  })
  it('lower-cases joining words in state and district names', () => {
    expect(lowerJoiningWords('Dadra And Nagar Haveli And Daman And Diu')).toBe('Dadra and Nagar Haveli and Daman and Diu')
  })
})

describe('parseCsv', () => {
  it('reads quoted fields with commas, doubled quotes and CRLF line ends', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,"x, ""y"""\r\n')).toEqual([{ a: '1', b: 'x, "y"' }])
  })
})

it('sqlText doubles single quotes', () => {
  expect(sqlText("Bhagat's Kothi")).toBe("'Bhagat''s Kothi'")
})
