// Types for places.generated.json (written by scripts/places/build.mjs), so TypeScript does not infer a type from
// 5,000 rows. Rows are tuples to keep the file small.
declare const places: {
  source: string
  /** [id, name, 1 if union territory else 0] */
  states: [string, string, number][]
  /** [id, stateId, name] */
  districts: [string, string, string][]
  /** [id, stateId, name, districtIds] */
  towns: [string, string, string, string[]][]
}
export default places
