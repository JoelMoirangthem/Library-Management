/**
 * Owners type their area by hand (D-045). These helpers keep spellings comparable without a fixed list.
 * The database applies the same rules (migration 0016), so a value saved here is already in its final form.
 */

/** Same limit as the `libraries_area_tidy` check in migration 0016. */
export const MAX_AREA_LENGTH = 60

/** Trim and collapse any run of white space: "  Gomti   Nagar " -> "Gomti Nagar". */
export function cleanArea(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Comparison key: case and extra spaces do not matter. */
export function areaKey(raw: string): string {
  return cleanArea(raw).toLowerCase()
}

/** True when both name the same place. A blank area never matches anything, not even another blank. */
export function sameArea(a: string, b: string): boolean {
  const key = areaKey(a)
  return key !== '' && key === areaKey(b)
}

/** Unique area names (the first spelling wins), blanks dropped, sorted A-Z. */
export function mergeAreaNames(names: string[]): string[] {
  const byKey = new Map<string, string>()
  for (const name of names) {
    const clean = cleanArea(name)
    if (clean && !byKey.has(clean.toLowerCase())) byKey.set(clean.toLowerCase(), clean)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}
