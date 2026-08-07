const base = import.meta.env.BASE_URL

export const DESKTOP_QUERY = '(min-width: 900px)'

export const isDesktopViewport = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches

/**
 * Only one variant is ever requested: the src is resolved in JS instead of
 * relying on <source media="…">, which browsers evaluate inconsistently and
 * which would make phones download the 1080p files as well.
 */
export const filmSources = (desktop: boolean) => {
  const dir = desktop ? 'video/desktop' : 'video/mobile'
  const suffix = desktop ? '' : '-720p'
  return {
    one: `${base}${dir}/01-the-signal-gop1${suffix}.mp4`,
    two: `${base}${dir}/02-the-network-gop1${suffix}.mp4`,
  }
}

export const TRANSITION_CHIP = `${base}images/transition-chip.png`
export const FINAL_EARTH = `${base}images/final-earth.png`
