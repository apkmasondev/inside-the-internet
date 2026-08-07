interface LoaderProps {
  /** How much of the first film is buffered, 0..1. */
  progress: number
  /** The first film is ready to seek — start dissolving. */
  done: boolean
}

export function Loader({ progress, done }: LoaderProps) {
  return (
    <div className={done ? 'loader loader--done' : 'loader'} role="status">
      <p className="eyebrow">Inside the Internet</p>
      <div className="loader__track">
        <span
          className="loader__fill"
          style={{ transform: `scaleX(${done ? 1 : progress})` }}
        />
      </div>
    </div>
  )
}
