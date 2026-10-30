// Builds the state -> district -> town lists from the government's Local Government Directory (LGD).
//
//   node scripts/places/build.mjs <folder with the LGD csv files> [--report]
//
// Needs four files from https://github.com/ramSeraph/opendata/releases/tag/lgd-latest (unpack the .7z first):
//   states.<date>.csv, districts.<date>.csv, urban_local_bodies.<date>.csv, statewise_ulbs_coverage.<date>.csv
// Writes:
//   supabase/migrations/0015_state_district_city.sql   (template + data)
//   src/repositories/mock/places.generated.json         (the same lists for dummy mode)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanTownName, lowerJoiningWords, parseCsv, sqlText, titleCaseIfShouting } from './clean.mjs'
import { LIVE_CITIES, MERGED_CITIES, MISSING_DISTRICT, RENAMED, WRONG_DISTRICT } from './overrides.mjs'

const [folder, flag] = process.argv.slice(2)
if (!folder) {
  console.error('Usage: node scripts/places/build.mjs <folder with LGD csv files> [--report]')
  process.exit(2)
}
const report = flag === '--report'
const root = new URL('../../', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')

function readLgd(prefix) {
  const file = readdirSync(folder).find((f) => f.startsWith(prefix + '.') && f.endsWith('.csv'))
  if (!file) throw new Error(`No ${prefix}.<date>.csv in ${folder}`)
  return { rows: parseCsv(readFileSync(join(folder, file), 'utf8')), date: file.slice(prefix.length + 1, -4) }
}
const fail = (msg) => { throw new Error(msg) }
const placeName = (s) => lowerJoiningWords(titleCaseIfShouting(s.trim().replace(/\s+/g, ' ')))
const byName = (a, b) => a.name.localeCompare(b.name, 'en')

// ---------------------------------------------------------------- states and districts
const statesCsv = readLgd('states')
const states = statesCsv.rows.map((r) => ({
  code: `S${r['State Code']}`,
  name: placeName(r['State Name (In English)']),
  isUnionTerritory: r['State or UT'] === 'U',
})).sort(byName)
const stateByName = new Map(states.map((s) => [s.name.toLowerCase(), s]))
const stateOf = (rawName) => stateByName.get(placeName(rawName).toLowerCase()) ?? fail(`Unknown state ${rawName}`)

const districts = readLgd('districts').rows.map((r) => ({
  code: `D${r['District Code']}`,
  stateCode: `S${r['State Code']}`,
  name: placeName(r['District Name(In English)']),
})).sort(byName)
const districtByCode = new Map(districts.map((d) => [d.code, d]))
const districtsOfState = (stateCode) => districts.filter((d) => d.stateCode === stateCode)
const districtNamed = (stateCode, name) =>
  districtsOfState(stateCode).find((d) => d.name.toLowerCase() === name.toLowerCase()) ?? fail(`No district ${name} in ${stateCode}`)

// ---------------------------------------------------------------- towns (urban local bodies)
// Which districts each town covers, weighted by how many of its villages/wards lie in each.
const coverage = new Map()
for (const r of readLgd('statewise_ulbs_coverage').rows) {
  if (!r['District Code']) continue
  const m = coverage.get(r['Local Body Code']) ?? new Map()
  const key = `D${r['District Code']}`
  m.set(key, (m.get(key) ?? 0) + 1)
  coverage.set(r['Local Body Code'], m)
}

const ulbs = readLgd('urban_local_bodies').rows
const replaced = new Set(MERGED_CITIES.flatMap((m) => m.replaces))
const usedMissing = new Set()
let towns = []
for (const u of ulbs) {
  const raw = u['Local Body Name (In English)']
  if (replaced.has(raw)) continue
  const state = stateOf(u['State Name'])
  const weights = coverage.get(u['Local Body Code'])
  let districtCodes = weights ? [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c) : []
  if (!districtCodes.length) {
    const fix = MISSING_DISTRICT[state.name]?.[raw] ?? fail(`${raw} (${state.name}) has no district: add it to MISSING_DISTRICT`)
    usedMissing.add(`${state.name}|${raw}`)
    districtCodes = [districtNamed(state.code, fix).code]
  }
  const moved = WRONG_DISTRICT[state.name]?.[raw]
  if (moved) {
    usedMissing.add(`moved|${state.name}|${raw}`)
    districtCodes = [districtNamed(state.code, moved).code]
  }
  for (const c of districtCodes) {
    const d = districtByCode.get(c) ?? fail(`${raw}: unknown district ${c}`)
    if (d.stateCode !== state.code) fail(`${raw}: district ${d.name} is not in ${state.name}`)
  }
  const cleaned = cleanTownName(raw)
  towns.push({ code: `C${u['Local Body Code']}`, raw, name: RENAMED[`${state.name}|${cleaned}`] ?? cleaned, stateCode: state.code, districtCodes, type: Number(u['Localbody Type Code']) })
}
for (const [stateName, fixes] of Object.entries(MISSING_DISTRICT)) {
  for (const raw of Object.keys(fixes)) if (!usedMissing.has(`${stateName}|${raw}`)) fail(`MISSING_DISTRICT ${stateName}/${raw} is not needed any more: remove it`)
}
for (const [stateName, fixes] of Object.entries(WRONG_DISTRICT)) {
  for (const raw of Object.keys(fixes)) if (!usedMissing.has(`moved|${stateName}|${raw}`)) fail(`WRONG_DISTRICT ${stateName}/${raw} matched nothing: remove it`)
}
for (const key of Object.keys(RENAMED)) if (!towns.some((t) => RENAMED[key] === t.name && key.endsWith('|' + cleanTownName(t.raw)))) fail(`RENAMED ${key} matched nothing`)

for (const m of MERGED_CITIES) {
  const state = stateOf(m.state)
  const parts = ulbs.filter((u) => m.replaces.includes(u['Local Body Name (In English)']))
  if (parts.length !== m.replaces.length) fail(`${m.name}: expected ${m.replaces.length} councils, found ${parts.length}`)
  const codes = m.allDistricts
    ? districtsOfState(state.code).map((d) => d.code)
    : [...new Set(parts.flatMap((u) => [...(coverage.get(u['Local Body Code'])?.keys() ?? [])]))]
  towns.push({ code: m.code, raw: m.replaces.join(' + '), name: m.name, stateCode: state.code, districtCodes: codes, type: 0 })
}

// A district with no municipal town at all (mostly hill and tribal districts, e.g. Churachandpur, Kinnaur) would leave
// owners there nothing to pick. Give each one entry named after the district; an admin can add real towns later.
const coveredDistricts = new Set(towns.flatMap((t) => t.districtCodes))
const districtOnly = []
for (const d of districts) {
  if (coveredDistricts.has(d.code)) continue
  const name = d.name.replace(/\s+District$/i, '')
  districtOnly.push(`${name} (${d.stateCode})`)
  towns.push({ code: `C-${d.code}`, raw: d.name, name, stateCode: d.stateCode, districtCodes: [d.code], type: 99 })
}

// Some LGD names carry the wrong district in brackets (the two Gosainganj and Kursath towns are swapped, and Atmakur
// moved from Kurnool to the new Nandyal district). The district a town's wards actually lie in is more reliable than
// free text, so a bracket that names another district of the same state is rewritten to the town's real district.
const relabelled = []
for (const t of towns) {
  const m = t.name.match(/^(.*) \(([^)]+)\)$/)
  const named = m && districtsOfState(t.stateCode).find((d) => d.name.toLowerCase() === m[2].toLowerCase())
  if (named && !t.districtCodes.includes(named.code)) {
    const real = districtByCode.get(t.districtCodes[0]).name
    relabelled.push(`${t.name} -> ${m[1]} (${real})`)
    t.name = `${m[1]} (${real})`
  }
}

// The same town listed twice (an old council and the one that replaced it, e.g. Itanagar): same state, same name,
// same main district. Keep one, preferring the bigger body (lower LGD type number), covering both sets of districts.
const sameTown = new Map()
const mergedPairs = []
for (const t of towns) {
  const k = `${t.stateCode}|${t.name.toLowerCase()}|${t.districtCodes[0]}`
  const prev = sameTown.get(k)
  if (!prev) { sameTown.set(k, t); continue }
  mergedPairs.push(`${prev.code} ${prev.raw} + ${t.code} ${t.raw} -> ${t.name}`)
  const keep = t.type < prev.type ? t : prev
  keep.districtCodes = [...new Set([...keep.districtCodes, ...(keep === t ? prev : t).districtCodes])]
  sameTown.set(k, keep)
}
const mergedDuplicates = towns.length - sameTown.size
towns = [...sameTown.values()]

// Two towns with the same name in one state: add the main district, e.g. "Rajgarh (Alwar)".
const key = (t) => `${t.stateCode}|${t.name.toLowerCase()}`
const clashes = new Map()
for (const t of towns) clashes.set(key(t), [...(clashes.get(key(t)) ?? []), t])
const renamedForClash = []
for (const group of clashes.values()) {
  if (group.length < 2) continue
  for (const t of group) {
    const d = districtByCode.get(t.districtCodes[0]).name
    if (!t.name.toLowerCase().includes(`(${d.toLowerCase()})`)) {
      renamedForClash.push(`${t.name} -> ${t.name} (${d})`)
      t.name = `${t.name} (${d})`
    }
  }
}
const stillClashing = [...new Set(towns.map(key))].length !== towns.length
if (stillClashing) {
  const seen = new Map()
  for (const t of towns) seen.set(key(t), [...(seen.get(key(t)) ?? []), t.code])
  fail('Town names still clash: ' + [...seen.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `${k}: ${v}`).join('; '))
}
towns = towns.sort(byName)

for (const live of LIVE_CITIES) {
  const st = stateOf(live.state)
  const hits = towns.filter((t) => t.stateCode === st.code && t.name === live.town)
  if (hits.length !== 1) fail(`Live city ${live.liveName}: expected one town ${live.town} in ${live.state}, found ${hits.length}`)
  live.code = hits[0].code
}

// ---------------------------------------------------------------- report
if (report) {
  const perDistrict = new Map()
  for (const t of towns) for (const c of t.districtCodes) perDistrict.set(c, (perDistrict.get(c) ?? 0) + 1)
  const noTowns = districts.filter((d) => !perDistrict.has(d.code))
  const busiest = [...perDistrict.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `${districtByCode.get(c).name} ${n}`)
  console.log(`LGD ${statesCsv.date}: ${states.length} states, ${districts.length} districts, ${towns.length} towns`)
  console.log(`towns in 2+ districts: ${towns.filter((t) => t.districtCodes.length > 1).length}; busiest districts: ${busiest.join(', ')}`)
  console.log(`districts with no town: ${noTowns.length}; district-named entries added: ${districtOnly.length}`, districtOnly)
  console.log(`renamed by cleaning: ${towns.filter((t) => t.name !== t.raw).length}; duplicate listings merged: ${mergedDuplicates}`)
  console.log('clash renames:', renamedForClash.length, renamedForClash.slice(0, 12))
  console.log('live cities:', LIVE_CITIES.map((l) => `${l.liveName}=${l.code}`).join(', '))
  console.log('relabelled to their real district:', relabelled)
  console.log('merged duplicate listings:', mergedPairs)
  console.log('sample cleaned:', towns.filter((t) => t.name !== t.raw && !t.name.includes('(')).slice(0, 15).map((t) => `${t.raw} -> ${t.name}`))
  // A bracket that names a different district of the same state than the town is in: the label or the data is wrong.
  const contradictions = towns.flatMap((t) => {
    const label = t.name.match(/\(([^)]+)\)\s*$/)?.[1]?.toLowerCase()
    const named = label && districtsOfState(t.stateCode).find((d) => d.name.toLowerCase() === label)
    return named && !t.districtCodes.includes(named.code)
      ? [`${t.code} ${t.name}: in ${t.districtCodes.map((c) => districtByCode.get(c).name).join('/')}`]
      : []
  })
  console.log('bracket names a district the town is not in:', contradictions.length, contradictions)
  const short = towns.filter((t) => /^[A-Z][a-z]{0,2}$|^[A-Z]{2,4}$/.test(t.name)).map((t) => `${t.code} ${t.name}`)
  console.log('very short names (abbreviations?):', short)
  process.exit(0)
}

// ---------------------------------------------------------------- outputs
const values = (rows) => rows.join(',\n')
const data = `-- ---------------------------------------------------------------- data (generated from LGD ${statesCsv.date})
insert into public.states (code, name, is_union_territory) values
${values(states.map((s) => `(${sqlText(s.code)}, ${sqlText(s.name)}, ${s.isUnionTerritory})`))};

insert into public.districts (code, state_id, name)
select v.code, s.id, v.name
from (values
${values(districts.map((d) => `(${sqlText(d.code)}, ${sqlText(d.stateCode)}, ${sqlText(d.name)})`))}
) as v(code, state_code, name)
join public.states s on s.code = v.state_code;

create temporary table place_import_towns (code text primary key, name text not null, state_code text not null, district_codes text[] not null) on commit drop;
insert into place_import_towns values
${values(towns.map((t) => `(${sqlText(t.code)}, ${sqlText(t.name)}, ${sqlText(t.stateCode)}, '{${t.districtCodes.join(',')}}')`))};

create temporary table place_import_live (live_name text primary key, code text not null) on commit drop;
insert into place_import_live values
${values(LIVE_CITIES.map((l) => `(${sqlText(l.liveName.toLowerCase())}, ${sqlText(l.code)})`))};
`
const template = readFileSync(join(root, 'scripts/places/0015.template.sql'), 'utf8')
if (!template.includes('-- @@PLACE_DATA@@')) fail('Template has no -- @@PLACE_DATA@@ marker')
writeFileSync(join(root, 'supabase/migrations/0015_state_district_city.sql'), template.replace('-- @@PLACE_DATA@@', data))

const json = {
  source: `LGD ${statesCsv.date}`,
  states: states.map((s) => [s.code, s.name, s.isUnionTerritory ? 1 : 0]),
  districts: districts.map((d) => [d.code, d.stateCode, d.name]),
  towns: towns.map((t) => [t.code, t.stateCode, t.name, t.districtCodes]),
}
writeFileSync(join(root, 'src/repositories/mock/places.generated.json'), JSON.stringify(json))
console.log(`Wrote ${states.length} states, ${districts.length} districts, ${towns.length} towns (LGD ${statesCsv.date}).`)
