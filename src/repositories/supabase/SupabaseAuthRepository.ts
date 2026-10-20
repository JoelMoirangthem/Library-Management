import { adminLoginEmail } from '@/domain/adminLogin'
import { AppError } from '@/domain/errors'
import { isValidPhone, normalizePhone } from '@/domain/constants'
import type { Profile } from '@/domain/types'
import { getSupabase } from '@/lib/supabase'
import type { AuthRepository } from '@/repositories/interfaces'
import { toAppErrorFromSupabase, unwrap } from '@/repositories/supabase/errors'

type ProfileRow = { id: string; name: string; email: string; phone: string; role: Profile['role'] }

const toProfile = (r: ProfileRow): Profile => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role })

async function loadProfile(userId: string): Promise<Profile> {
  const supabase = getSupabase()
  const row = unwrap(
    await supabase.from('profiles').select('id, name, email, phone, role').eq('id', userId).single<ProfileRow>(),
  )
  return toProfile(row)
}

/** Real sign-in with Google through Supabase Auth. The profile row is created by a database trigger. */
export class SupabaseAuthRepository implements AuthRepository {
  async getSession(): Promise<Profile | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.getSession()
    if (error) throw toAppErrorFromSupabase(error)
    if (!data.session) return null
    try {
      return await loadProfile(data.session.user.id)
    } catch (e) {
      // A brand new user may reach this a moment before the profile trigger has finished.
      if (e instanceof AppError && e.code === 'not_found') return null
      throw e
    }
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login`, queryParams: { prompt: 'select_account' } },
    })
    if (error) throw toAppErrorFromSupabase(error)
  }

  async signInAdmin(userId: string, password: string): Promise<Profile> {
    // One message for every failure (unknown ID, wrong password, not an admin) so the page never reveals which part was wrong.
    const wrong = new AppError('forbidden', 'Wrong user ID or password.')
    const email = adminLoginEmail(userId)
    if (!email || !password) throw wrong
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      if (error && /rate|too many|over_/i.test(`${error.code ?? ''} ${error.message}`)) {
        throw new AppError('forbidden', 'Too many attempts. Wait a few minutes and try again.')
      }
      if (error && /email_provider_disabled|disabled/i.test(`${error.code ?? ''} ${error.message}`)) {
        throw new AppError('forbidden', 'Password sign-in is switched off for this project.')
      }
      throw wrong
    }
    let profile: Profile
    try {
      profile = await loadProfile(data.session.user.id)
    } catch {
      await supabase.auth.signOut()
      throw wrong
    }
    if (profile.role !== 'admin') {
      // A correct password for an account that is not an administrator must not leave a session behind.
      await supabase.auth.signOut()
      throw wrong
    }
    return profile
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabase().auth.signOut()
    if (error) throw toAppErrorFromSupabase(error)
  }

  async setMyRole(role: 'student' | 'owner'): Promise<Profile> {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('set_my_role', { new_role: role })
    if (error) throw toAppErrorFromSupabase(error)
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new AppError('forbidden', 'Sign in to continue.')
    return loadProfile(data.session.user.id)
  }

  async updateProfile(patch: { name: string; phone: string }): Promise<Profile> {
    const supabase = getSupabase()
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new AppError('forbidden', 'Sign in to continue.')
    if (!patch.name.trim()) throw new AppError('invalid', 'Enter your name.')
    if (!isValidPhone(patch.phone)) throw new AppError('invalid', 'Enter a 10-digit mobile number.')
    const row = unwrap(
      await supabase
        .from('profiles')
        .update({ name: patch.name.trim(), phone: normalizePhone(patch.phone) })
        .eq('id', data.session.user.id)
        .select('id, name, email, phone, role')
        .single<ProfileRow>(),
    )
    return toProfile(row)
  }
}
