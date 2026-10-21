/** The fields of a library a student can find it by. */
export type SearchableLibrary = {
  name: string
  areaName: string
  cityName: string
  landmark: string
  address: string
  pincode: string
}

/**
 * Does a library match what the student typed? The text is split into words; EVERY word must appear somewhere in the
 * library's name, area, city, landmark, address or pincode (capital letters and spacing are ignored, and a word can be
 * part of a longer one). So "gomti lucknow", "xyz 226010" and "luck" all work. Plain text comparison only, never a pattern.
 */
export function matchesLibrarySearch(lib: SearchableLibrary, text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [lib.name, lib.areaName, lib.cityName, lib.landmark, lib.address, lib.pincode]
    .map((f) => (f ?? '').toLowerCase())
    .join(' | ')
  return words.every((w) => haystack.includes(w))
}