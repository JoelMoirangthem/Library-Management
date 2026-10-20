import { describe, expect, it } from 'vitest'
import { buildAdminSql, validateAdminInput } from './adminAccount.mjs'

const goodId = 'studyAdmin2028'
const goodPw = 'k7#Vq2$Lm9@Rt4!zXw'
const email = 'studyadmin2028@admin.studyseat.invalid'

describe('validateAdminInput', () => {
  it('accepts a normal user ID and a strong password', () => {
    expect(validateAdminInput(goodId, goodPw, goodPw)).toEqual({ ok: true, email, userId: 'studyadmin2028' })
  })

  it('refuses when the two typed passwords differ', () => {
    expect(validateAdminInput(goodId, goodPw, goodPw + 'x')).toMatchObject({ ok: false, problem: expect.stringMatching(/match/i) })
  })

  it('refuses a weak password and says why', () => {
    expect(validateAdminInput(goodId, 'Welcome#Library2031x', 'Welcome#Library2031x')).toMatchObject({ ok: false, problem: expect.stringMatching(/\S/) })
  })

  it('refuses an unusable user ID', () => {
    expect(validateAdminInput('a b', goodPw, goodPw)).toMatchObject({ ok: false })
    expect(validateAdminInput('', goodPw, goodPw)).toMatchObject({ ok: false })
  })
})

describe('buildAdminSql (creates the admin or changes the password; the password is a quoted value inside one statement)', () => {
  const sql = buildAdminSql(email, 'Study Admin', goodPw)

  it('lets the database create an email account for this one address, and only inside this statement', () => {
    expect(sql).toMatch(/set_config\('studyseat\.allow_email_user', 'on', true\)/)
  })

  it('has the database make the password hash (bcrypt), so no plain password is stored', () => {
    expect(sql).toMatch(/extensions\.crypt\(/)
    expect(sql).toMatch(/extensions\.gen_salt\('bf'/)
  })

  it('makes the account an admin and confirmed, so it can sign in at once', () => {
    expect(sql).toMatch(/role = 'admin'/)
    expect(sql).toMatch(/email_confirmed_at/)
  })

  it('updates the existing account when run again, instead of creating a second one', () => {
    expect(sql).toMatch(/if not found|update auth\.users/i)
  })

  it('refuses an address outside the admin domain, so the tool can never overwrite a real person', () => {
    expect(() => buildAdminSql('someone@gmail.com', 'x', goodPw)).toThrow(/admin\.studyseat\.invalid/)
  })

  it('cannot be broken out of with quotes, dollar signs or backslashes in the password or name', () => {
    const nasty = `a'b"c$$d\\e$f;--`
    const q = buildAdminSql(email, "O'Brien", nasty)
    expect(q).toContain("O''Brien")
    expect(q).toContain(`a''b"c$$d\\e$f;--`) // the single quote is doubled; dollar quoting is never used for values
    expect(q).not.toMatch(/\$tag\$|\$body\$/) // values are in ordinary quotes
  })
})

describe('buildAdminSql: the statement wrapper cannot be closed early by what is typed inside it', () => {
  const email2 = 'studyadmin2028@admin.studyseat.invalid'
  // The wrapper is `do $tag$ ... $tag$;`. Dollar signs in a password must never be able to end it.
  const wrapperTag = (sql) => /^do (\$[a-z0-9_]*\$)\n/.exec(sql)?.[1]

  it('uses a wrapper tag that is not the bare $$', () => {
    const tag = wrapperTag(buildAdminSql(email2, 'x', goodPw))
    expect(tag).toBeTruthy()
    expect(tag).not.toBe('$$')
  })

  it('the tag appears exactly twice: once to open and once to close', () => {
    const sql = buildAdminSql(email2, 'x', 'a$$b$q$c$ab$d')
    const tag = wrapperTag(sql)
    expect(sql.split(tag).length - 1).toBe(2)
  })

  it('passwords full of dollar signs and tag-like text still leave exactly one closing tag', () => {
    for (const pw of ['$$', '$$$$', 'x$$y', '$a$', '$q$', '$tag$ ; drop table x; $tag$', 'k7#$$Vq2$Lm9@Rt4!']) {
      const sql = buildAdminSql(email2, 'Name $$', pw)
      const tag = wrapperTag(sql)
      expect(sql.split(tag).length - 1, pw).toBe(2)
      expect(sql.trimEnd().endsWith(`${tag};`), pw).toBe(true)
    }
  })

  it('a different tag each time, so it cannot be guessed ahead', () => {
    expect(wrapperTag(buildAdminSql(email2, 'x', goodPw))).not.toBe(wrapperTag(buildAdminSql(email2, 'x', goodPw)))
  })
})
