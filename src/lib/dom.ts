const cache = new WeakMap<HTMLElement, Record<string, string>>()

/**
 * Writes a style property only when it actually changed.
 * Keeps the per-frame overlay work down to a handful of composited updates.
 */
export const setStyle = (
  el: HTMLElement | null,
  prop: string,
  value: string,
): void => {
  if (!el) return
  let entry = cache.get(el)
  if (!entry) {
    entry = {}
    cache.set(el, entry)
  }
  if (entry[prop] === value) return
  entry[prop] = value
  el.style.setProperty(prop, value)
}
