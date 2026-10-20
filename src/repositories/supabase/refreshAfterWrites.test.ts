import { describe, expect, it, vi } from 'vitest'
import { refreshAfterWrites } from '@/repositories/supabase/refreshAfterWrites'

class FakeRepo {
  value = 7
  async listThings() {
    return [this.value]
  }
  async getOne() {
    return this.value
  }
  async searchAll() {
    return []
  }
  async countPending() {
    return 3
  }
  async approve(id: string) {
    return `approved ${id} with ${this.value}`
  }
  async reject() {
    throw new Error('refused')
  }
}

describe('refreshAfterWrites', () => {
  it('tells screens to reload after a successful write, and passes the result and `this` through', async () => {
    const notify = vi.fn()
    const repo = refreshAfterWrites(new FakeRepo(), notify)
    await expect(repo.approve('lib1')).resolves.toBe('approved lib1 with 7')
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('does not reload for reads (get, list, search, count): a count that reloaded the screen would loop forever', async () => {
    const notify = vi.fn()
    const repo = refreshAfterWrites(new FakeRepo(), notify)
    await repo.listThings()
    await repo.getOne()
    await repo.searchAll()
    expect(await repo.countPending()).toBe(3)
    expect(notify).not.toHaveBeenCalled()
  })

  it('does not reload when the write fails, and the error still reaches the caller', async () => {
    const notify = vi.fn()
    const repo = refreshAfterWrites(new FakeRepo(), notify)
    await expect(repo.reject()).rejects.toThrow('refused')
    expect(notify).not.toHaveBeenCalled()
  })
})
