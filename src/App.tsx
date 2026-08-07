import { useEffect, useState } from 'react'
import { Experience } from './components/Experience'
import { StillJourney } from './components/StillJourney'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches

export default function App() {
  // Resolved before the first paint so the reduced-motion route never
  // requests a video file.
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced ? <StillJourney /> : <Experience />
}
