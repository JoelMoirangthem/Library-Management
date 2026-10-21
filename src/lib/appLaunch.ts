/** The parts of `document` the watcher uses (the real `document` fits), so it can be tested without a browser. */
export type WatchedDocument = {
  readonly visibilityState: string
  addEventListener(type: 'visibilitychange' | 'pagehide', listener: () => void): void
  removeEventListener(type: 'visibilitychange' | 'pagehide', listener: () => void): void
}

/**
 * A browser cannot tell a page whether the app behind a `upi://` link opened. But when an app does open, the browser goes
 * to the background (the page becomes hidden or is left). So: after a tap, if the page is STILL in front after `waitMs`,
 * nothing opened and `onNotOpened` is called once. Returns a function that cancels the check.
 */
export function watchForAppLaunch(doc: WatchedDocument, onNotOpened: () => void, waitMs = 1800): () => void {
  let done = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const finish = () => {
    if (done) return
    done = true
    if (timer !== undefined) clearTimeout(timer)
    doc.removeEventListener('visibilitychange', onVisibility)
    doc.removeEventListener('pagehide', onLeave)
  }
  function onVisibility() {
    if (doc.visibilityState === 'hidden') finish() // the app took over the screen
  }
  function onLeave() {
    finish()
  }

  doc.addEventListener('visibilitychange', onVisibility)
  doc.addEventListener('pagehide', onLeave)
  timer = setTimeout(() => {
    if (done) return
    finish()
    onNotOpened()
  }, waitMs)

  return finish
}