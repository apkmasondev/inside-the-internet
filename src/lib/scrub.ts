const FPS = 24

/**
 * Ceilings on how fast the playhead may travel, in video seconds per real
 * second. The story's inertia lives in the progress spring, so this only bites
 * on a real jump — a replay, an anchor, a flick past a whole chapter — where it
 * turns a hard cut into a fast rewind.
 */
const MAX_RATE = 7.5
const FAST_RATE = 30
const FAST_THRESHOLD = 1.5

export interface FilmTrack {
  el: HTMLVideoElement
  /** Full duration reported by the decoder, 0 until metadata arrives. */
  duration: number
  /** Start of the final frame — the furthest we ever seek. */
  end: number
  /** Playhead we are driving the element towards, before frame snapping. */
  time: number
  /** Last frame time actually written to the element, -1 before the first. */
  written: number
  /** Element has at least one decoded frame, so seeking is safe. */
  ready: boolean
}

export const createTrack = (el: HTMLVideoElement): FilmTrack => ({
  el,
  duration: 0,
  end: 0,
  time: 0,
  written: -1,
  ready: false,
})

export const setTrackDuration = (track: FilmTrack, duration: number): void => {
  if (!Number.isFinite(duration) || duration <= 0) return
  track.duration = duration
  // Exact start of the last frame: seeking here always lands on a real frame,
  // and never past the end where the decoder would clamp.
  const frames = Math.max(1, Math.round(duration * FPS))
  track.end = (frames - 1) / FPS
}

/**
 * Picks up duration and seekability straight from the element.
 * Deliberately not event-driven: `readyState` dips back below HAVE_CURRENT_DATA
 * while a seek is in flight, so a latched flag set from an event handler can
 * end up stuck on the wrong value.
 */
export const syncTrack = (track: FilmTrack): boolean => {
  if (track.duration <= 0) setTrackDuration(track, track.el.duration)
  if (!track.ready && track.el.readyState >= 2) track.ready = true
  return track.ready && track.end > 0
}

/**
 * Moves the track one tick closer to `target` and seeks to the nearest frame.
 *
 * Snapping to exact frame boundaries is what makes the motion read as smooth:
 * a sub-frame seek costs the decoder a full seek but often shows the very same
 * picture, so the visible cadence ends up uneven — one frame, nothing, one
 * frame, nothing, nothing. On frame boundaries every step is one visible frame,
 * and a decelerating playhead reads as a clean 3-3-2-2-1 ramp.
 *
 * `snap` jumps immediately — used at the chapter boundary, where the two films
 * must be aligned on the exact frame before the opacity handoff runs.
 */
export const advanceTrack = (
  track: FilmTrack,
  target: number,
  dt: number,
  snap: boolean,
): void => {
  if (!syncTrack(track)) return

  const wanted = target < 0 ? 0 : target > track.end ? track.end : target
  if (snap) {
    track.time = wanted
  } else {
    const diff = wanted - track.time
    const limit = (Math.abs(diff) > FAST_THRESHOLD ? FAST_RATE : MAX_RATE) * dt
    track.time += diff < -limit ? -limit : diff > limit ? limit : diff
  }

  const frame = Math.min(track.end, Math.max(0, Math.round(track.time * FPS) / FPS))

  // A seek that is still in flight would only be cancelled by a new one.
  if (track.el.seeking) return
  if (track.written === frame) return
  track.written = frame
  track.el.currentTime = frame
}
