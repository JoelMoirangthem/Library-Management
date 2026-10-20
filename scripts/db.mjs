// Runs the Supabase CLI against the database named in .env.
//   npm run db:push                       apply new files from supabase/migrations
//   npm run db:query -- "select 1"        run one SQL statement
// Node loads .env for us (see package.json). The password is never printed.
import { spawnSync } from 'node:child_process'
import { buildDbUrl, maskSecret, quoteForCmd } from './dbUrl.mjs'

const [command, ...rest] = process.argv.slice(2)
const allowed = { push: ['db', 'push'], query: ['db', 'query'] }
if (!allowed[command]) {
  console.error('Usage: npm run db:push   or   npm run db:query -- "<sql>"')
  process.exit(2)
}

let url
try {
  url = buildDbUrl(process.env)
} catch (e) {
  console.error(e.message)
  process.exit(2)
}

const secret = process.env.SUPABASE_DB_PASSWORD.trim()
const args = [...allowed[command], '--db-url', url, ...rest]
// On Windows the CLI is a .cmd shim that only the command shell can start, and the shell splits text at spaces,
// so every argument is quoted. Elsewhere no shell is involved.
const windows = process.platform === 'win32'
const run = spawnSync('supabase', windows ? args.map(quoteForCmd) : args, { encoding: 'utf8', shell: windows, input: command === 'push' ? 'y\n' : undefined })
process.stdout.write(maskSecret(run.stdout ?? '', secret))
process.stderr.write(maskSecret(run.stderr ?? '', secret))
process.exit(run.status ?? 1)