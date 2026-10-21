import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchForAppLaunch, type WatchedDocument } from '@/lib/appLaunch'

/** The smallest stand-in for `document` the watcher needs. */
function fakeDocument() {
  const listeners = new Map<string, Set<() => void>>()
  const doc: WatchedDocument & { visibilityState: string; fire(type: string): void; count(): number } = {
    visibilityState: 'visible',
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn)
    },
    fire(type) {
      listeners.get(type)?.forEach((fn) => fn())
    },
    count: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
  }
  return doc
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('watchForAppLaunch (did the UPI app actually open after the tap?)', () => {
  it('says "not opened" when the page is still in front after the wait', () => {
    const doc = fakeDocument(); const notOpened = vi.fn()
    watchForAppLaunch(doc, notOpened, 1800)
    vi.advanceTimersByTime(1799); expect(notOpened).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(notOpened).toHaveBeenCalledTimes(1)
  })

  it('stays quiet when the app takes over the screen (the page goes to the background)', () => {
    const doc = fakeDocument(); const notOpened = vi.fn()
    watchForAppLaunch(doc, notOpened, 1800)
    vi.advanceTimersByTime(600); doc.visibilityState = 'hidden'; doc.fire('visibilitychange')
    vi.advanceTimersByTime(5000)
    expect(notOpened).not.toHaveBeenCalled()
  })

  it('also stays quiet when the page is being left (pagehide)', () => {
    const doc = fakeDocument(); const notOpened = vi.fn()
    watchForAppLaunch(doc, notOpened, 1800)
    doc.fire('pagehide'); vi.advanceTimersByTime(5000)
    expect(notOpened).not.toHaveBeenCalled()
  })

  it('a visibility change that leaves the page visible does not cancel the check', () => {
    const doc = fakeDocument(); const notOpened = vi.fn()
    watchForAppLaunch(doc, notOpened, 1800)
    doc.fire('visibilitychange'); vi.advanceTimersByTime(1800)
    expect(notOpened).toHaveBeenCalledTimes(1)
  })

  it('can be cancelled, and then never fires', () => {
    const doc = fakeDocument(); const notOpened = vi.fn()
    const stop = watchForAppLaunch(doc, notOpened, 1800)
    stop(); vi.advanceTimersByTime(5000)
    expect(notOpened).not.toHaveBeenCalled()
  })

  it('removes every listener when it finishes, whichever way it ends', () => {
    const a = fakeDocument(); watchForAppLaunch(a, () => {}, 1800); vi.advanceTimersByTime(1800); expect(a.count()).toBe(0)
    const b = fakeDocument(); watchForAppLaunch(b, () => {}, 1800); b.visibilityState = 'hidden'; b.fire('visibilitychange'); expect(b.count()).toBe(0)
    const c = fakeDocument(); const stop = watchForAppLaunch(c, () => {}, 1800); stop(); expect(c.count()).toBe(0)
  })

  it('two taps in a row only report once', () => {
    const doc = fakeDocument(); const notOpened = vi.fn()
    const first = watchForAppLaunch(doc, notOpened, 1800); first()
    watchForAppLaunch(doc, notOpened, 1800)
    vi.advanceTimersByTime(5000)
    expect(notOpened).toHaveBeenCalledTimes(1)
  })
})