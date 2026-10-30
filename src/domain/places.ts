/**
 * One line naming where a library is, smallest place first: "Aliganj, Lucknow" or "Kakori, Lucknow, Uttar Pradesh".
 * Empty parts are skipped, and a part equal to the one before it is dropped (Lucknow town in Lucknow district).
 */
export function placeLine(parts: (string | null | undefined)[]): string {
  const out: string[] = []
  for (const p of parts) {
    const v = (p ?? '').trim()
    if (v && v.toLowerCase() !== out[out.length - 1]?.toLowerCase()) out.push(v)
  }
  return out.join(', ')
}

type Named = { areaName: string; cityName: string; districtName?: string; stateName?: string }

/** For cards: "Aliganj, Lucknow", or town and district when there is no area: "Kakori, Lucknow". */
export function shortPlace(p: Named): string {
  return p.areaName ? placeLine([p.areaName, p.cityName]) : placeLine([p.cityName, p.districtName])
}

/** For an address: "Aliganj, Lucknow, Uttar Pradesh" (the district is skipped when it repeats the town). */
export function fullPlace(p: Named): string {
  return placeLine([p.areaName, p.cityName, p.districtName, p.stateName])
}
