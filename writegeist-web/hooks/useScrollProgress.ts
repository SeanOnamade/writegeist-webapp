'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Scroll progress (0–100) of a scrollable element. Recomputes on scroll and
 * on element resize — no arbitrary timers.
 */
export function useScrollProgress<T extends HTMLElement>(contentKey: unknown) {
  const ref = useRef<T>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const scrollHeight = element.scrollHeight - element.clientHeight
      const value = scrollHeight > 0 ? (element.scrollTop / scrollHeight) * 100 : 0
      setProgress(Math.min(value, 100))
    }

    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (element.firstElementChild) {
      observer.observe(element.firstElementChild)
    }

    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
    // Re-bind when the rendered content changes (new chapter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey])

  return { ref, progress }
}
