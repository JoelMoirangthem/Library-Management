import type { PhotoRepository } from '@/repositories/interfaces'

/** Dummy mode has no storage: a photo is kept as a data link inside the browser, as before. */
export class MockPhotoRepository implements PhotoRepository {
  upload(image: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read that image.'))
      reader.readAsDataURL(image)
    })
  }

  async remove(): Promise<void> {}

  async keepOnly(): Promise<void> {}
}