import { useEffect, useRef, useState } from 'react'

/**
 * Animate a number from 0 (or previous value) to target.
 * Uses requestAnimationFrame with ease-out cubic for a premium feel.
 */
export function useCountUp(target, { duration = 1200, decimals = 0 } = {}) {
  const [value, setValue] = useState(0)
  const startTimeRef = useRef(null)
  const fromRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const numTarget = parseFloat(target)
    if (isNaN(numTarget)) { setValue(0); return }

    fromRef.current = value
    startTimeRef.current = null
    cancelAnimationFrame(rafRef.current)

    const tick = (t) => {
      if (!startTimeRef.current) startTimeRef.current = t
      const elapsed = t - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const current = fromRef.current + (numTarget - fromRef.current) * eased
      setValue(decimals === 0 ? Math.round(current) : parseFloat(current.toFixed(decimals)))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals])

  return value
}
