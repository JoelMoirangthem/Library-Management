import { describe, expect, it } from 'vitest'
import { PHOTO_BUCKET, MAX_PHOTOS, objectNameFromUrl, photoObjectName, urlsToKeepNames } from '@/domain/photos'

const OWNER = '72617677-4cb0-45d0-9668-8796d687aeb1'
const BASE = 'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/LibraryImages'

describe('photo paths', () => {
  it('uses the public bucket and a limit of 4 photos', () => {
    expect(PHOTO_BUCKET).toBe('LibraryImages')
    expect(MAX_PHOTOS).toBe(4)
  })

  it('builds one flat folder per owner with a random jpg name', () => {
    expect(photoObjectName(OWNER, 'abc-123')).toBe(`${OWNER}/abc-123.jpg`)
  })

  it('reads the object name back out of a public link', () => {
    expect(objectNameFromUrl(`${BASE}/${OWNER}/abc-123.jpg`)).toBe(`${OWNER}/abc-123.jpg`)
  })

  it('ignores links that are not files in this bucket', () => {
    expect(objectNameFromUrl('data:image/jpeg;base64,AAAA')).toBeNull()
    expect(objectNameFromUrl('https://example.com/pic.jpg')).toBeNull()
    expect(objectNameFromUrl(`${BASE}/`)).toBeNull()
    expect(objectNameFromUrl('')).toBeNull()
  })

  it('ignores a query string on the link', () => {
    expect(objectNameFromUrl(`${BASE}/${OWNER}/a.jpg?cb=1`)).toBe(`${OWNER}/a.jpg`)
  })

  it('keeps the names of the photos still in use, skipping anything that is not a stored file', () => {
    const keep = urlsToKeepNames([`${BASE}/${OWNER}/a.jpg`, 'data:image/png;base64,AAAA', `${BASE}/${OWNER}/b.png`])
    expect([...keep].sort()).toEqual([`${OWNER}/a.jpg`, `${OWNER}/b.png`])
  })
})