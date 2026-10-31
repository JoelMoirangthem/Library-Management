import { describe, expect, it } from 'vitest'
import { fullPlace, placeLine, shortPlace } from '@/domain/places'

describe('placeLine', () => {
  it('joins the parts smallest first', () => {
    expect(placeLine(['Aliganj', 'Lucknow'])).toBe('Aliganj, Lucknow')
  })
  it('skips empty parts', () => {
    expect(placeLine(['', 'Kakori', null, 'Uttar Pradesh'])).toBe('Kakori, Uttar Pradesh')
  })
  it('drops a part equal to the one before it', () => {
    expect(placeLine(['', 'Lucknow', 'lucknow', 'Uttar Pradesh'])).toBe('Lucknow, Uttar Pradesh')
  })
  it('gives an empty string for nothing', () => {
    expect(placeLine([undefined, ' '])).toBe('')
  })
})

describe('shortPlace and fullPlace', () => {
  const withArea = { areaName: 'Aliganj', cityName: 'Lucknow', districtName: 'Lucknow', stateName: 'Uttar Pradesh' }
  const noArea = { areaName: '', cityName: 'Kakori', districtName: 'Lucknow', stateName: 'Uttar Pradesh' }
  it('shows area and town, or town and district when there is no area', () => {
    expect(shortPlace(withArea)).toBe('Aliganj, Lucknow')
    expect(shortPlace(noArea)).toBe('Kakori, Lucknow')
  })
  it('shows the full place without repeating a name', () => {
    expect(fullPlace(withArea)).toBe('Aliganj, Lucknow, Uttar Pradesh')
    expect(fullPlace(noArea)).toBe('Kakori, Lucknow, Uttar Pradesh')
  })
})
