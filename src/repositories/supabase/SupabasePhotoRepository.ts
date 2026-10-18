import { AppError } from '@/domain/errors'
import { objectNameFromUrl, photoObjectName, PHOTO_BUCKET, urlsToKeepNames } from '@/domain/photos'
import { getSupabase } from '@/lib/supabase'
import type { PhotoRepository } from '@/repositories/interfaces'
import { currentUserId } from '@/repositories/supabase/mappers'

/**
 * Photos in the public "LibraryImages" bucket, one folder per owner. The database rules (migration 0010)
 * decide who may write: only an owner, only into their own folder, JPEG or PNG, 5 MB, 20 files.
 */
export class SupabasePhotoRepository implements PhotoRepository {
  async upload(image: Blob): Promise<string> {
    const supabase = getSupabase()
    const ownerId = await currentUserId()
    const name = photoObjectName(ownerId, crypto.randomUUID())
    // The random name never repeats, so the file never changes and browsers may keep it for a year.
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(name, image, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
    if (error) throw new AppError('unknown', uploadMessage(error.message))
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(name).data.publicUrl
  }

  async remove(urls: string[]): Promise<void> {
    const names = urls.map(objectNameFromUrl).filter((n): n is string => n !== null)
    if (names.length === 0) return
    const { error } = await getSupabase().storage.from(PHOTO_BUCKET).remove(names)
    if (error) throw new AppError('unknown', 'Could not remove the photo. Try again.')
  }

  async keepOnly(urls: string[]): Promise<void> {
    const supabase = getSupabase()
    const ownerId = await currentUserId()
    const keep = urlsToKeepNames(urls)
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(ownerId, { limit: 100 })
    if (error) throw new AppError('unknown', 'Could not tidy up photos.')
    const stale = (data ?? []).map((f) => `${ownerId}/${f.name}`).filter((n) => !keep.has(n))
    if (stale.length === 0) return
    await supabase.storage.from(PHOTO_BUCKET).remove(stale)
  }
}

/** Storage errors are technical; give the owner a sentence they can act on. */
function uploadMessage(raw: string): string {
  if (/exceeded the maximum allowed size|too large|payload/i.test(raw)) return 'That photo is too large. Try a smaller one.'
  if (/row-level security|unauthorized|not allowed/i.test(raw)) return 'You can have at most 20 photos stored, or you are not allowed to upload here.'
  if (/mime|type/i.test(raw)) return 'Only JPEG and PNG photos are accepted.'
  return 'Could not upload the photo. Check your connection and try again.'
}