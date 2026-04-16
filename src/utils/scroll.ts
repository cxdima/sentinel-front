import { decodeText } from './animation'

/** Linear scroll progress through an element: 0 at top, 1 at bottom */
export function scrollProgress(el: HTMLElement): number {
  const rect     = el.getBoundingClientRect()
  const scrolled = -rect.top
  const total    = el.offsetHeight - window.innerHeight
  return Math.max(0, Math.min(1, scrolled / total))
}

/** Map a progress value through a sub-range, outputs 0→1 */
export function subRange(p: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (p - start) / (end - start)))
}

export const ease = {
  inOut:    (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  outExpo:  (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
}

/** Spring snap-scroll to a target Y position */
export function springScrollTo(target: number, onDone?: () => void): void {
  let current = window.scrollY
  let vel = 0
  const stiffness = 0.08
  const damping   = 0.72

  function frame() {
    const force = (target - current) * stiffness
    vel         = (vel + force) * damping
    current    += vel
    window.scrollTo(0, current)
    if (Math.abs(vel) > 0.3) {
      requestAnimationFrame(frame)
    } else {
      window.scrollTo(0, target)
      onDone?.()
    }
  }
  requestAnimationFrame(frame)
}

/** Wire IntersectionObserver scroll-reveal for .reveal elements */
export function initReveal(): void {
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view')

          // Trigger text scramble on data-scramble elements
          const scrambleEl = entry.target.querySelector<HTMLElement>('[data-scramble]')
          if (scrambleEl && !scrambleEl.dataset.scrambled) {
            scrambleEl.dataset.scrambled = 'true'
            const finalText = scrambleEl.dataset.scramble ?? scrambleEl.textContent ?? ''
            scrambleReveal(scrambleEl, finalText)
          }

          // Auto-decode IBM Plex Mono text elements
          decodeMonoChildren(entry.target as HTMLElement)

          obs.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  )
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale')
    .forEach(el => obs.observe(el))
}

/** Decode all IBM Plex Mono leaf-text children within a container */
function decodeMonoChildren(container: HTMLElement): void {
  // Skip components that have their own animation logic
  if (container.closest('hero-section') || container.closest('trust-sim')) return

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT)
  let node: Node | null = walker.currentNode
  while (node) {
    const el = node as HTMLElement
    if (
      el.childElementCount === 0 &&
      el.textContent?.trim() &&
      !el.dataset.decoded &&
      !el.dataset.scrambled
    ) {
      const font = getComputedStyle(el).fontFamily.toLowerCase()
      if (font.includes('ibm plex mono') || font.includes('monospace')) {
        el.dataset.decoded = 'true'
        decodeText(el, 2800) // slower, more dramatic decode
      }
    }
    node = walker.nextNode()
  }
}

const SCRAMBLE_CHARS = '▓▒░█▄▀■□ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'

function scrambleReveal(el: HTMLElement, finalText: string, duration = 2000): void {
  const len = finalText.length
  const totalFrames = Math.round(duration / 30)
  let frame = 0

  el.classList.add('decoding')

  const interval = setInterval(() => {
    el.textContent = finalText
      .split('')
      .map((char, i) => {
        if (char === ' ') return ' '
        const resolveAt = Math.floor((i / len) * totalFrames * 0.6)
        return frame > resolveAt ? char : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
      })
      .join('')

    frame++
    if (frame >= totalFrames) {
      el.textContent = finalText
      el.classList.remove('decoding')
      clearInterval(interval)
    }
  }, 30)
}
