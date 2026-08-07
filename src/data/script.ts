export interface Cue {
  /** Chapter progress (0..1) where the line starts to appear. */
  at: number
  /** Chapter progress where the line is fully gone. */
  until: number
  label?: string
  line: string
}

/** Gap between one cue leaving and the next arriving — only one line at a time. */
const GAP = 0.06

const build = (
  cues: Array<Omit<Cue, 'until'>>,
  lastUntil: number,
): Cue[] =>
  cues.map((cue, index) => ({
    ...cue,
    until: index === cues.length - 1 ? lastUntil : cues[index + 1].at - GAP,
  }))

export const CHAPTER_ONE_CUES = build(
  [
    { at: 0, label: '01 / THE SIGNAL', line: 'Every click begins somewhere real.' },
    { at: 0.3, line: 'Copper. Silicon. Light.' },
    { at: 0.62, line: 'Distance becomes milliseconds.' },
    { at: 0.85, line: 'The network is physical.' },
  ],
  // Clears well before the handoff so nothing overlaps the cut.
  0.96,
)

export const CHAPTER_TWO_CUES = build(
  [
    { at: 0, label: '02 / THE NETWORK', line: 'One signal becomes billions.' },
    { at: 0.35, line: 'Cities become nodes.' },
    { at: 0.67, line: 'Connections cross every border.' },
    { at: 0.88, line: 'And the network becomes the world.' },
  ],
  // The last stretch belongs to the Earth alone.
  0.95,
)
