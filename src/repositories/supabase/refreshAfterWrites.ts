/**
 * Real database writes must tell every mounted screen to reload, or it keeps showing old data until
 * the page is refreshed (the dummy database does this itself on every save).
 * Any method that is not a read (name starting with get / list / search / count) counts as a write: once it
 * succeeds, `notify` runs. A failed write does not notify.
 */
const READ_METHOD = /^(get|list|search|count)/

export function refreshAfterWrites<T extends object>(repo: T, notify: () => void): T {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function' || typeof prop !== 'string' || READ_METHOD.test(prop)) return value
      return async (...args: unknown[]) => {
        const result = await (value as (...a: unknown[]) => unknown).apply(target, args)
        notify()
        return result
      }
    },
  })
}
