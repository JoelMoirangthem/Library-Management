import { describe, expect, it } from 'vitest'
import { ADMIN_LOGIN_DOMAIN, adminLoginEmail, adminPasswordProblem, isAdminLoginEmail } from '@/domain/adminLogin'

describe('adminLoginEmail (the admin types a user ID; Supabase needs an email-shaped address)', () => {
  it('turns the user ID into an address on a domain that can never receive mail', () => {
    expect(adminLoginEmail('studyAdmin2028')).toBe(`studyadmin2028@${ADMIN_LOGIN_DOMAIN}`)
    expect(ADMIN_LOGIN_DOMAIN.endsWith('.invalid')).toBe(true)
  })

  it('ignores capital letters and spaces around the user ID', () => {
    expect(adminLoginEmail('  StudyAdmin2028 ')).toBe(adminLoginEmail('studyadmin2028'))
  })

  it('accepts letters, digits, dot, dash and underscore', () => {
    expect(adminLoginEmail('a.b-c_d9')).toBe(`a.b-c_d9@${ADMIN_LOGIN_DOMAIN}`)
  })

  it('refuses anything that could change which address is meant', () => {
    for (const bad of ['', '   ', 'a b', 'a@b', 'a@admin.studyseat.invalid', 'a/b', 'a\\b', "a'b", 'a"b', 'a;b', 'a,b', 'a+b', 'a<b>', 'x'.repeat(65), 'é']) {
      expect(adminLoginEmail(bad), JSON.stringify(bad)).toBeNull()
    }
  })

  it('a real person email address is never accepted as a user ID', () => {
    expect(adminLoginEmail('someone@gmail.com')).toBeNull()
  })
})

describe('isAdminLoginEmail', () => {
  it('recognises the internal address and nothing else', () => {
    expect(isAdminLoginEmail(`studyadmin2028@${ADMIN_LOGIN_DOMAIN}`)).toBe(true)
    expect(isAdminLoginEmail('someone@gmail.com')).toBe(false)
    expect(isAdminLoginEmail('')).toBe(false)
  })
})

describe('adminPasswordProblem (a strong password for the account that approves libraries and verifies money)', () => {
  const strong = 'k7#Vq2$Lm9@Rt4!zXw'
  it('accepts a long mixed password', () => {
    expect(adminPasswordProblem(strong, 'studyadmin2028')).toBeNull()
  })

  it('needs at least 14 characters', () => {
    expect(adminPasswordProblem('Ab1!cdEf2@gH', 'studyadmin2028')).toMatch(/14/)
  })

  it('needs lower case, upper case, a digit and a symbol', () => {
    expect(adminPasswordProblem('abcdefghijklmnop1!', 'u')).toMatch(/capital/i)
    expect(adminPasswordProblem('ABCDEFGHIJKLMNOP1!', 'u')).toMatch(/small/i)
    expect(adminPasswordProblem('Abcdefghijklmnop!!', 'u')).toMatch(/digit/i)
    expect(adminPasswordProblem('Abcdefghijklmnop12', 'u')).toMatch(/symbol/i)
  })

  it('refuses easy words and years, which are the first things guessed', () => {
    for (const weak of ['Hello@Library!Xyz9', 'MyStudySeat#Pass99x', 'Password#Strong12ab', 'Admin#Secure2028xyz', 'Q7!w7!studyadmin2028Z', 'Zk8#NearMe!Qv4xLm7']) {
      expect(adminPasswordProblem(weak, 'studyadmin2028'), weak).not.toBeNull()
    }
  })

  it('refuses a password that repeats one character or walks the keyboard', () => {
    expect(adminPasswordProblem('Aaaaaaaaaaaaaa1!', 'u')).not.toBeNull()
    expect(adminPasswordProblem('Qwerty123456!Zx', 'u')).not.toBeNull()
  })
})