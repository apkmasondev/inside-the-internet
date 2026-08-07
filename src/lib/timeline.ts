/**
 * The whole experience is one continuous scroll timeline.
 * Every length below is expressed in `vh`, so the mapping between scroll
 * position and story position stays identical on any viewport height.
 */
export const INTRO_VH = 120
/**
 * A chapter's length is really a statement about how much picture moves per
 * pixel scrolled. At 500vh a 10 s / 24 fps film advances one frame roughly
 * every 19 px, which keeps the image alive under a slow scroll; the 800vh the
 * brief suggested worked out at 30 px per frame, where the footage crawls.
 */
export const CHAPTER_ONE_VH = 500
export const HANDOFF_VH = 14
export const CHAPTER_TWO_VH = 500
export const FINALE_VH = 220

/** Total height of the scroll spacer. */
export const TOTAL_VH =
  INTRO_VH + CHAPTER_ONE_VH + HANDOFF_VH + CHAPTER_TWO_VH + FINALE_VH

/** Scrollable distance: the last viewport of the spacer is the resting frame. */
export const SCROLL_VH = TOTAL_VH - 100

const CHAPTER_ONE_START = INTRO_VH
const HANDOFF_START = CHAPTER_ONE_START + CHAPTER_ONE_VH
const CHAPTER_TWO_START = HANDOFF_START + HANDOFF_VH
const FINALE_START = CHAPTER_TWO_START + CHAPTER_TWO_VH
const FINALE_SCROLL_VH = SCROLL_VH - FINALE_START

export interface TimelineState {
  /** 0..1 across the intro hold. */
  intro: number
  /** 0..1 across chapter 01. */
  one: number
  /** 0..1 across the film 1 -> film 2 handoff. */
  handoff: number
  /** 0..1 across chapter 02. */
  two: number
  /** 0..1 across the closing hold. */
  finale: number
}

export const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value

/** Calm, symmetric easing used for every fade in the piece. */
export const smoothstep = (value: number): number => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

/** Splits the global scroll progress (0..1) into per-act progress values. */
export const readTimeline = (progress: number): TimelineState => {
  const vh = clamp01(progress) * SCROLL_VH
  return {
    intro: clamp01(vh / INTRO_VH),
    one: clamp01((vh - CHAPTER_ONE_START) / CHAPTER_ONE_VH),
    handoff: clamp01((vh - HANDOFF_START) / HANDOFF_VH),
    two: clamp01((vh - CHAPTER_TWO_START) / CHAPTER_TWO_VH),
    finale: clamp01((vh - FINALE_START) / FINALE_SCROLL_VH),
  }
}
