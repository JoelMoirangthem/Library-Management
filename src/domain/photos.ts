/**
 * Library photos are files in the public Supabase Storage bucket, one flat folder per owner:
 *   LibraryImages/<owner user id>/<random>.jpg
 * libraries.photos holds only their public links. The database enforces the same shape
 * (supabase/migrations/0010_photo_storage.sql), so these helpers only build and read the paths.
 */
export const PHOTO_BUCKET = 'LibraryImages'
export const MAX_PHOTOS = 4

/** The name of a new photo file inside the owner's own folder. The picker always uploads JPEG. */
export function photoObjectName(ownerId: string, randomId: string): string {
  return `${ownerId}/${randomId}.jpg`
}

const PUBLIC_PATH = `/storage/v1/object/public/${PHOTO_BUCKET}/`

/** `<owner>/<file>` from a public link, or null when the link is not a stored file (for example a data: URL). */
export function objectNameFromUrl(url: string): string | null {
  const at = url.indexOf(PUBLIC_PATH)
  if (at === -1) return null
  const name = url.slice(at + PUBLIC_PATH.length).split('?')[0]
  return name.length > 0 ? name : null
}

/** The set of stored file names still in use, ignoring anything that is not a stored file. */
export function urlsToKeepNames(urls: string[]): Set<string> {
  const names = new Set<string>()
  for (const u of urls) {
    const n = objectNameFromUrl(u)
    if (n) names.add(n)
  }
  return names
}