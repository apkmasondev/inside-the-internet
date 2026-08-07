import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CHAPTER_ONE_CUES, CHAPTER_TWO_CUES, type Cue } from '../data/script'
import { setStyle } from '../lib/dom'
import { filmSources, isDesktopViewport } from '../lib/media'
import { advanceTrack, createTrack, syncTrack, type FilmTrack } from '../lib/scrub'
import { advanceSpring, createSpring } from '../lib/spring'
import { TOTAL_VH, clamp01, readTimeline, smoothstep } from '../lib/timeline'
import { Loader } from './Loader'

gsap.registerPlugin(ScrollTrigger)

/**
 * The one place inertia lives, in rad/s. Everything on screen — both films, the
 * copy, the rail, the opening dim — is rendered from this eased progress, so
 * the whole picture decelerates as a single object when the scroll stops.
 * Lower is heavier and slower to settle, higher is tighter and more literal.
 */
const SCROLL_STIFFNESS = 14

/** Cue cross-fade length, in chapter progress. */
const CUE_FADE = 0.05
/** Vertical drift of a cue as it arrives and leaves, in px. */
const CUE_DRIFT = 16

type Phase = 'loading' | 'revealing' | 'live'

const applyCue = (el: HTMLElement | null, progress: number, cue: Cue): void => {
  if (!el) return
  const entering = smoothstep((progress - cue.at) / CUE_FADE)
  const leaving = smoothstep((cue.until - progress) / CUE_FADE)
  const opacity = Math.min(entering, leaving)
  const drift = (1 - entering) * CUE_DRIFT - (1 - leaving) * CUE_DRIFT
  setStyle(el, 'opacity', opacity.toFixed(3))
  setStyle(el, 'transform', `translate3d(0, ${drift.toFixed(2)}px, 0)`)
}

const waitFor = (el: HTMLVideoElement, event: string): Promise<void> =>
  new Promise((resolve) => {
    el.addEventListener(event, () => resolve(), { once: true })
  })

const after = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

/**
 * Decodes the first frame so the element is genuinely seekable.
 * Mobile Safari only paints a frame after playback has been started once, so
 * the film is played and paused while the loader still covers the screen.
 * Never allowed to stall the experience: readiness itself comes from
 * `loadeddata`, this only improves the very first paint.
 */
const primeFilm = async (el: HTMLVideoElement): Promise<void> => {
  if (el.readyState < 2) await Promise.race([waitFor(el, 'loadeddata'), after(8000)])
  if (el.readyState < 2) return
  try {
    await Promise.race([el.play(), after(1200)])
    el.pause()
  } catch {
    // Muted autoplay refused — seeking still works everywhere else.
  }
  el.currentTime = 0
}

export function Experience() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [buffered, setBuffered] = useState(0)
  // Resolved once: swapping the source mid-journey would re-download a film.
  const [desktop] = useState(isDesktopViewport)

  const filmOneRef = useRef<HTMLVideoElement>(null)
  const filmTwoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLButtonElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const railFillRef = useRef<HTMLSpanElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  const markerOneRef = useRef<HTMLSpanElement>(null)
  const markerTwoRef = useRef<HTMLSpanElement>(null)
  const finaleRef = useRef<HTMLDivElement>(null)
  const finaleKickerRef = useRef<HTMLParagraphElement>(null)
  const finaleLineRef = useRef<HTMLParagraphElement>(null)
  const replayRef = useRef<HTMLDivElement>(null)
  const cueOneRefs = useRef<Array<HTMLDivElement | null>>([])
  const cueTwoRefs = useRef<Array<HTMLDivElement | null>>([])

  /** Raw scroll position, written by ScrollTrigger. */
  const progressRef = useRef(0)
  /** Eased scroll position, the single source everything on screen reads. */
  const easedRef = useRef(createSpring())
  const sources = filmSources(desktop)

  useEffect(() => {
    const one = filmOneRef.current
    const two = filmTwoRef.current
    const spacer = spacerRef.current
    if (!one || !two || !spacer) return

    let cancelled = false
    const trackOne: FilmTrack = createTrack(one)
    const trackTwo: FilmTrack = createTrack(two)
    let secondRequested = false

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    document.documentElement.classList.add('is-locked')
    window.scrollTo(0, 0)

    const onBuffered = () => {
      if (!one.duration || !one.buffered.length) return
      setBuffered(clamp01(one.buffered.end(one.buffered.length - 1) / one.duration))
    }
    one.addEventListener('progress', onBuffered)

    one.src = sources.one
    one.load()

    const requestSecondFilm = () => {
      if (secondRequested || cancelled) return
      secondRequested = true
      two.src = sources.two
      two.load()
      void primeFilm(two)
    }

    // The second film only starts downloading once the first one is buffered,
    // and at the latest halfway through chapter 01.
    const onFirstBuffered = () => requestSecondFilm()
    one.addEventListener('canplaythrough', onFirstBuffered)

    void primeFilm(one).then(() => {
      if (cancelled) return
      one.removeEventListener('progress', onBuffered)
      setBuffered(1)
      setPhase('revealing')
    })

    if (replayRef.current) replayRef.current.inert = true

    const tick = (_time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs, 60) / 1000
      const eased = advanceSpring(easedRef.current, progressRef.current, dt, SCROLL_STIFFNESS)
      const t = readTimeline(eased)

      if (t.one > 0.5) requestSecondFilm()

      // --- film timing -------------------------------------------------
      const targetOne = t.handoff > 0 ? trackOne.end : t.one * trackOne.end
      const targetTwo = t.handoff < 1 ? 0 : t.two * trackTwo.end
      advanceTrack(trackOne, targetOne, dt, t.handoff > 0)
      advanceTrack(trackTwo, targetTwo, dt, t.handoff < 1)

      // --- handoff ------------------------------------------------------
      // Film 1 stays fully opaque underneath while film 2 fades in on top,
      // so there is never a moment where the background shows through.
      const handoffReady = syncTrack(trackTwo)
      const cover = handoffReady ? t.handoff : 0
      setStyle(two, 'opacity', cover.toFixed(3))
      setStyle(one, 'visibility', cover >= 1 ? 'hidden' : 'visible')

      // --- intro --------------------------------------------------------
      const wake = smoothstep(t.intro / 0.85)
      setStyle(stageRef.current, 'opacity', (0.24 + 0.76 * wake).toFixed(3))

      const introOut = 1 - smoothstep(t.intro / 0.5)
      setStyle(introRef.current, 'opacity', introOut.toFixed(3))
      setStyle(
        introRef.current,
        'transform',
        `translate3d(0, ${(-18 * (1 - introOut)).toFixed(2)}px, 0)`,
      )
      setStyle(hintRef.current, 'opacity', (1 - smoothstep(t.intro / 0.22)).toFixed(3))

      // --- chapter cues ---------------------------------------------------
      for (let i = 0; i < CHAPTER_ONE_CUES.length; i += 1) {
        applyCue(cueOneRefs.current[i], t.one, CHAPTER_ONE_CUES[i])
      }
      for (let i = 0; i < CHAPTER_TWO_CUES.length; i += 1) {
        applyCue(cueTwoRefs.current[i], t.two, CHAPTER_TWO_CUES[i])
      }

      // --- chrome ---------------------------------------------------------
      // Rail and chapter mark arrive after the intro and leave for the finale.
      const chromeIn = smoothstep((t.intro - 0.55) / 0.45)
      const chromeOut = 1 - smoothstep((t.finale - 0.1) / 0.25)
      const chrome = chromeIn * chromeOut
      setStyle(railRef.current, 'opacity', chrome.toFixed(3))
      setStyle(markerRef.current, 'opacity', chrome.toFixed(3))
      setStyle(scrimRef.current, 'opacity', chrome.toFixed(3))
      setStyle(railFillRef.current, 'transform', `scaleY(${clamp01(eased).toFixed(4)})`)
      // Sequential, never superimposed: 01 leaves before 02 arrives.
      setStyle(markerOneRef.current, 'opacity', (1 - clamp01(t.handoff * 2)).toFixed(3))
      setStyle(markerTwoRef.current, 'opacity', clamp01(t.handoff * 2 - 1).toFixed(3))

      // --- finale -----------------------------------------------------------
      const kicker = smoothstep((t.finale - 0.18) / 0.2)
      const line = smoothstep((t.finale - 0.34) / 0.22)
      const replay = smoothstep((t.finale - 0.62) / 0.2)
      setStyle(veilRef.current, 'opacity', smoothstep((t.finale - 0.1) / 0.22).toFixed(3))
      setStyle(finaleRef.current, 'visibility', t.finale > 0 ? 'visible' : 'hidden')
      setStyle(finaleKickerRef.current, 'opacity', kicker.toFixed(3))
      setStyle(
        finaleKickerRef.current,
        'transform',
        `translate3d(0, ${(14 * (1 - kicker)).toFixed(2)}px, 0)`,
      )
      setStyle(finaleLineRef.current, 'opacity', line.toFixed(3))
      setStyle(
        finaleLineRef.current,
        'transform',
        `translate3d(0, ${(18 * (1 - line)).toFixed(2)}px, 0)`,
      )
      setStyle(replayRef.current, 'opacity', replay.toFixed(3))
      setStyle(replayRef.current, 'pointer-events', replay > 0.9 ? 'auto' : 'none')
      if (replayRef.current) replayRef.current.inert = replay <= 0.9
    }

    gsap.ticker.add(tick)

    return () => {
      cancelled = true
      gsap.ticker.remove(tick)
      one.removeEventListener('progress', onBuffered)
      one.removeEventListener('canplaythrough', onFirstBuffered)
      document.documentElement.classList.remove('is-locked')
    }
  }, [sources.one, sources.two])

  // Scrolling is locked until the first film can be seeked, so the
  // ScrollTrigger is only measured once the page can actually scroll.
  const started = phase !== 'loading'
  useEffect(() => {
    const spacer = spacerRef.current
    if (!started || !spacer) return

    document.documentElement.classList.remove('is-locked')

    // The mobile browser bar changing height must not re-measure the timeline:
    // every length is in `vh`, so the layout does not actually change.
    ScrollTrigger.config({ ignoreMobileResize: true })

    const trigger = ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        progressRef.current = self.progress
      },
      onRefresh: (self) => {
        progressRef.current = self.progress
      },
    })

    // A resize or orientation change keeps the position in the *story*,
    // not the position in pixels.
    let held = progressRef.current
    const onRefreshInit = () => {
      held = progressRef.current
    }
    const onRefreshed = () => {
      const max = ScrollTrigger.maxScroll(window)
      if (max > 0) window.scrollTo(0, held * max)
      // Land on the restored position instead of easing towards it.
      easedRef.current.value = progressRef.current
      easedRef.current.velocity = 0
    }
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit)
    ScrollTrigger.addEventListener('refresh', onRefreshed)
    ScrollTrigger.refresh()

    const id = window.setTimeout(() => setPhase('live'), 900)
    return () => {
      window.clearTimeout(id)
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit)
      ScrollTrigger.removeEventListener('refresh', onRefreshed)
      trigger.kill()
    }
  }, [started])

  const [copied, setCopied] = useState(false)

  const replay = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const enterJourney = () => {
    const max = ScrollTrigger.maxScroll(window)
    if (max > 0) window.scrollTo({ top: (120 / TOTAL_VH) * max, behavior: 'smooth' })
  }

  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Inside the Internet',
          text: 'A scroll-driven cinematic experience following a signal from silicon to the global network.',
          url: window.location.href,
        })
        return
      } catch {
        // Native share dismissed or unavailable, fallback to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2500)
      } catch {
        // Ignore fallback failure
      }
    }
  }

  return (
    <>
      <div className="stage" ref={stageRef} aria-hidden="true">
        <video
          className="film"
          ref={filmOneRef}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
        />
        <video
          className="film film--second"
          ref={filmTwoRef}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
        />
        <div className="stage__scrim" ref={scrimRef} />
        <div className="stage__veil" ref={veilRef} />
      </div>

      <div className="rail" ref={railRef} aria-hidden="true">
        <span className="rail__fill" ref={railFillRef} />
      </div>

      <div className="marker" ref={markerRef} aria-hidden="true">
        <span className="marker__value" ref={markerOneRef}>
          01
        </span>
        <span className="marker__value" ref={markerTwoRef}>
          02
        </span>
      </div>

      <main className="overlay">
        <div className="intro" ref={introRef}>
          <p className="eyebrow">A journey beneath the screen</p>
          <h1 className="intro__title">Inside the Internet</h1>
          <p className="intro__sub">Every click begins somewhere real.</p>
        </div>

        <button type="button" className="hint" ref={hintRef} onClick={enterJourney} aria-label="Enter the journey">
          <span className="hint__pulse">Scroll to enter</span>
        </button>

        <section className="cues" aria-label="Chapter 01 — The Signal">
          {CHAPTER_ONE_CUES.map((cue, index) => (
            <div
              className="cue"
              key={cue.line}
              ref={(el) => {
                cueOneRefs.current[index] = el
              }}
            >
              {cue.label ? <p className="eyebrow">{cue.label}</p> : null}
              <p className="cue__line">{cue.line}</p>
            </div>
          ))}
        </section>

        <section className="cues" aria-label="Chapter 02 — The Network">
          {CHAPTER_TWO_CUES.map((cue, index) => (
            <div
              className="cue"
              key={cue.line}
              ref={(el) => {
                cueTwoRefs.current[index] = el
              }}
            >
              {cue.label ? <p className="eyebrow">{cue.label}</p> : null}
              <p className="cue__line">{cue.line}</p>
            </div>
          ))}
        </section>

        <div className="finale" ref={finaleRef}>
          <p className="eyebrow" ref={finaleKickerRef}>
            Inside the Internet
          </p>
          <p className="finale__line" ref={finaleLineRef}>
            Invisible. Physical. Everywhere.
          </p>
        </div>
      </main>

      <div className="replay" ref={replayRef}>
        <button
          type="button"
          className="replay__button"
          onClick={replay}
          aria-label="Replay the journey from the beginning"
        >
          Replay
        </button>
        <button
          type="button"
          className={`replay__button ${copied ? 'replay__button--copied' : ''}`}
          onClick={share}
          aria-label="Share this experience"
        >
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>

      <div className="spacer" ref={spacerRef} style={{ height: `${TOTAL_VH}vh` }} />

      {phase !== 'live' ? <Loader progress={buffered} done={phase === 'revealing'} /> : null}
    </>
  )
}
