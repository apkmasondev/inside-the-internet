export interface Spring {
  value: number
  velocity: number
}

export const createSpring = (value = 0): Spring => ({ value, velocity: 0 })

/**
 * Critically damped spring, integrated in closed form so any frame duration is
 * stable — a dropped frame or a backgrounded tab cannot produce a wild step.
 *
 * `stiffness` is in rad/s: the value trails a moving target by `2 * speed /
 * stiffness` and comes to rest in roughly `5 / stiffness` seconds. Because it
 * carries velocity, it keeps gliding when the target stops instead of braking.
 */
export const advanceSpring = (
  spring: Spring,
  target: number,
  dt: number,
  stiffness: number,
): number => {
  const offset = spring.value - target
  if (offset === 0 && spring.velocity === 0) return spring.value

  const decay = Math.exp(-stiffness * dt)
  const b = spring.velocity + stiffness * offset
  let next = (offset + b * dt) * decay
  let speed = (b - stiffness * (offset + b * dt)) * decay

  // Never sail past the target: an overshoot would read as the story briefly
  // running backwards.
  if (offset !== 0 && Math.sign(next) !== Math.sign(offset)) {
    next = 0
    speed = 0
  }

  spring.value = target + next
  spring.velocity = speed
  return spring.value
}
