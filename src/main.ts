import './styles/global.css'
import './styles/animations.css'

// Components — each self-registers as a custom element on import
import './components/nav-bar/nav-bar'
import './components/hero-section/hero-section'
import './components/blur-overlay/blur-overlay'
import './components/scrolly-section/scrolly-section'
import './components/feature-card/feature-card'
import './components/trust-sim/trust-sim'
import './components/immunity-map/immunity-map'
import './components/site-footer/site-footer'
import './components/timeline-compare/timeline-compare'
import './components/compare-table/compare-table'
import './components/war-room/war-room'
import './components/how-section/how-section'
import './components/cta-section/cta-section'
import './components/webgl-bg/webgl-bg'
import './components/marquee-ticker/marquee-ticker'
import './components/scroll-guide/scroll-guide'
import './components/landing-page/landing-page'
import './components/app-router/app-router'

import { initReveal } from './utils/scroll'

/** Initialize all landing page scroll effects */
function initLandingEffects() {
  initReveal()
  initCtaReveal()
  initHowFlowLine()
  initParallaxGrid()
}

/** Wait for Lit components to render, then init effects */
function scheduleInit() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initLandingEffects()
    })
  })
}

// Init on first load
document.addEventListener('DOMContentLoaded', scheduleInit)

// Re-init when navigating from dashboard back to landing
let wasOnDashboard = window.location.hash === '#/dashboard'

window.addEventListener('hashchange', () => {
  const isOnDashboard = window.location.hash === '#/dashboard'
  if (wasOnDashboard && !isOnDashboard) {
    scheduleInit()
  }
  wasOnDashboard = isOnDashboard
})

/** CTA section staggered reveal on scroll */
function initCtaReveal() {
  const ctaEls = document.querySelectorAll('.cta-reveal')
  if (!ctaEls.length) return

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view')
          obs.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
  )
  ctaEls.forEach(el => obs.observe(el))
}

/** Draw the How It Works flow line based on scroll progress */
function initHowFlowLine() {
  const flowLine = document.querySelector<SVGLineElement>('.how-flow-line')
  const howSection = document.getElementById('how')
  if (!flowLine || !howSection) return

  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const rect = howSection.getBoundingClientRect()
      const scrolled = -rect.top + window.innerHeight * 0.6
      const total = howSection.offsetHeight
      const progress = Math.max(0, Math.min(1, scrolled / total))
      flowLine.style.strokeDashoffset = String(1200 * (1 - progress))
      ticking = false
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

/** Subtle parallax on CTA grid background */
function initParallaxGrid() {
  const grid = document.querySelector<HTMLElement>('.parallax-grid')
  if (!grid) return

  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const parent = grid.parentElement
      if (!parent) { ticking = false; return }
      const rect = parent.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      const offset = (center - window.innerHeight / 2) * 0.04
      grid.style.transform = `translateY(${offset}px)`
      ticking = false
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })
}
