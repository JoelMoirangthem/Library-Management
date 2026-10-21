// Creates the administrator account, or changes its password. Run on YOUR computer:  npm run admin:set-password
//   - asks for the user ID and the password; what you type for the password is not shown;
//   - checks the password is strong (the same rules the website uses);
//   - sends it once, over the encrypted database connection, inside one statement; nothing is printed or kept.
// Needs SUPABASE_DB_PASSWORD in .env and the Email sign-in provider switched ON in the Supabase dashboard.
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { buildDbUrl, maskSecret, quoteForCmd } from './dbUrl.mjs'
import { buildAdminSql, validateAdminInput } from './adminAccount.mjs'

/**
 * Reads the answers one line at a time from ONE reader for the whole run (a reader per question loses typed-ahead lines
 * and breaks when the answers are piped in). Typing for a hidden question is not echoed to the screen.
 */
const rl = createInterface({ input: process.stdin, terminal: false, crlfDelay: Infinity })
const lines = rl[Symbol.asyncIterator]()
async function ask(question, hidden = false) {
  process.stdout.write(question)
  if (hidden && process.stdin.isTTY) process.stdin.setRawMode?.(false) // line mode; echo is switched off below
  const echoOff = hidden && process.stdin.isTTY
  if (echoOff) process.stdout.write('\x1b[8m') // "conceal" text attribute: typed characters are invisible
  const { value, done } = await lines.next()
  if (echoOff) process.stdout.write('\x1b[28m')
  if (hidden) process.stdout.write('\n')
  return done ? '' : String(value)
}
let url
try { url = buildDbUrl(process.env) } catch (e) { console.error(e.message); process.exit(2) }
const secret = process.env.SUPABASE_DB_PASSWORD.trim()

console.log('Administrator account for StudySeat\n')
const userId = (await ask('User ID (for example studyAdmin2028): ')).trim()
const password = await ask('New password (hidden): ', true)
const again = await ask('Type the password again (hidden): ', true)
const name = (await ask('Display name [Study Admin]: ')).trim() || 'Study Admin'

const checked = validateAdminInput(userId, password, again)
if (!checked.ok) { console.error('\nNot saved: ' + checked.problem); process.exit(1) }

const file = join(tmpdir(), `studyseat-admin-${process.pid}.sql`)
writeFileSync(file, buildAdminSql(checked.email, name, password), { mode: 0o600 })
const win = process.platform === 'win32'
const args = ['db', 'query', '--db-url', url, '-f', file]
const run = spawnSync('supabase', win ? args.map(quoteForCmd) : args, { encoding: 'utf8', shell: win })
try { unlinkSync(file) } catch { /* already gone */ }
if (run.status !== 0) { console.error('\nNot saved. The database said:\n' + maskSecret((run.stderr || run.stdout || '').split('\n').filter((l) => l.trim() && !/Connecting|DEP0190|trace-deprecation/.test(l)).slice(0, 4).join('\n'), secret).replaceAll(password, '****')); process.exit(1) }
rl.close()
console.log(`\nSaved. Sign in at /admin-login with user ID "${checked.userId}" and the password you just typed.`)