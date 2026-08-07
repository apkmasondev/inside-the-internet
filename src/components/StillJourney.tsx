import { useState } from 'react'
import { CHAPTER_ONE_CUES, CHAPTER_TWO_CUES } from '../data/script'
import { FINAL_EARTH, TRANSITION_CHIP } from '../lib/media'

/**
 * `prefers-reduced-motion` route: the same story told with key still frames
 * instead of a scrubbed film. No video is downloaded here at all.
 */
export function StillJourney() {
  const [copied, setCopied] = useState(false)

  const replay = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        // Native share dismissed, fallback to clipboard
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
    <main className="still">
      <section className="still__panel still__panel--intro">
        <div className="still__text">
          <p className="eyebrow">A journey beneath the screen</p>
          <h1 className="intro__title">Inside the Internet</h1>
          <p className="intro__sub">Every click begins somewhere real.</p>
        </div>
      </section>

      <section className="still__panel">
        <img className="still__frame" src={TRANSITION_CHIP} alt="" />
        <div className="still__text">
          <p className="eyebrow">01 / The Signal</p>
          {CHAPTER_ONE_CUES.map((cue) => (
            <p className="still__line" key={cue.line}>
              {cue.line}
            </p>
          ))}
        </div>
      </section>

      <section className="still__panel">
        <img className="still__frame" src={FINAL_EARTH} alt="" />
        <div className="still__text">
          <p className="eyebrow">02 / The Network</p>
          {CHAPTER_TWO_CUES.map((cue) => (
            <p className="still__line" key={cue.line}>
              {cue.line}
            </p>
          ))}
        </div>
      </section>

      <section className="still__panel still__panel--finale">
        <img className="still__frame" src={FINAL_EARTH} alt="" />
        <div className="still__text">
          <p className="eyebrow">Inside the Internet</p>
          <p className="finale__line">Invisible. Physical. Everywhere.</p>
        </div>
        <div className="still__actions">
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
      </section>
    </main>
  )
}
