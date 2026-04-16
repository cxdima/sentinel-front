/** Animated counter with quartic ease-out */
export function animateCount(
  el: HTMLElement,
  target: number,
  duration: number,
  format: (v: number) => string = String
): void {
  const start = performance.now()
  const tick  = (now: number) => {
    const t     = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 4)
    el.textContent = format(Math.round(eased * target))
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const DECODE_CHARS = '▓▒░█▄▀■□▪▫◊◆◇○●ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*<>{}[]~'

/**
 * Per-character decode animation: each letter cycles through
 * random characters before resolving to the final letter.
 * Staggered left-to-right with intentional slowness for drama.
 */
export function decodeText(el: HTMLElement, duration = 2800): void {
  const finalText = el.textContent ?? ''
  if (!finalText.trim()) return

  const len = finalText.length
  const frameInterval = 70 // slower frames for visible scramble
  const totalFrames = Math.ceil(duration / frameInterval)

  el.classList.add('decoding')

  // Each character resolves at a different frame, creating a wave
  const resolveFrames = finalText.split('').map((_, i) => {
    const progress = i / Math.max(len - 1, 1)
    // Spread resolution over 80% of the duration for a long wave effect
    const baseFrame = Math.floor(progress * totalFrames * 0.8)
    return baseFrame + Math.floor(Math.random() * 6)
  })

  let frame = 0
  const interval = setInterval(() => {
    el.textContent = finalText
      .split('')
      .map((char, i) => {
        if (char === ' ' || char === '\n') return char
        if (frame >= resolveFrames[i]) return char
        return DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)]
      })
      .join('')

    frame++
    if (frame >= totalFrames) {
      el.textContent = finalText
      el.classList.remove('decoding')
      clearInterval(interval)
    }
  }, frameInterval)
}

/** Text scramble reveal effect — slower, more dramatic */
export function scramble(el: HTMLElement, finalText: string, duration = 2400): Promise<void> {
  return new Promise(resolve => {
    const len         = finalText.length
    const frameRate   = 30 // ms per frame — slower for visibility
    const totalFrames = Math.round(duration / frameRate)
    let frame         = 0

    el.classList.add('decoding')

    const interval = setInterval(() => {
      el.textContent = finalText
        .split('')
        .map((char, i) => {
          if (char === ' ') return ' '
          // Characters resolve in a wave from left to right
          const resolveAt = Math.floor((i / len) * totalFrames * 0.65)
          return frame > resolveAt ? char : DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)]
        })
        .join('')

      frame++
      if (frame >= totalFrames) {
        el.textContent = finalText
        el.classList.remove('decoding')
        clearInterval(interval)
        resolve()
      }
    }, frameRate)
  })
}

/** SVG path draw based on progress 0→1 */
export function drawPath(path: SVGPathElement, progress: number): void {
  const len = path.getTotalLength()
  path.style.strokeDasharray  = String(len)
  path.style.strokeDashoffset = String(len * (1 - progress))
}

/** Run callback on first IntersectionObserver entry */
export function onVisible(
  el: HTMLElement,
  callback: () => void,
  options: IntersectionObserverInit = { threshold: 0.1 }
): void {
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      callback()
      obs.disconnect()
    }
  }, options)
  obs.observe(el)
}
