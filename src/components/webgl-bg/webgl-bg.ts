import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import './webgl-bg.css'

const NODE_COUNT = 80
const CONNECTION_DISTANCE = 120
const ATTACK_PARTICLE_COUNT = 6

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  isAttack: boolean
}

@customElement('webgl-bg')
export class WebglBg extends LitElement {
  override createRenderRoot() { return this }

  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private particles: Particle[] = []
  private frameId = 0
  private scrollY = 0
  private width = 0
  private height = 0
  private mouseX = 0
  private mouseY = 0
  private dpr = 1

  override firstUpdated() {
    this.canvas = this.querySelector<HTMLCanvasElement>('.webgl-canvas')
    if (!this.canvas) return

    this.ctx = this.canvas.getContext('2d')
    if (!this.ctx) return

    this.dpr = Math.min(window.devicePixelRatio, 2)
    this.resize()
    this.initParticles()

    window.addEventListener('resize', this.resize, { passive: true })
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('mousemove', this.onMouse, { passive: true })

    this.tick()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    cancelAnimationFrame(this.frameId)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('mousemove', this.onMouse)
  }

  private readonly resize = () => {
    if (!this.canvas) return
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * this.dpr
    this.canvas.height = this.height * this.dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
  }

  private readonly onScroll = () => {
    this.scrollY = window.scrollY
  }

  private readonly onMouse = (e: MouseEvent) => {
    this.mouseX = e.clientX
    this.mouseY = e.clientY
  }

  private initParticles() {
    this.particles = []
    for (let i = 0; i < NODE_COUNT; i++) {
      const isAttack = i < ATTACK_PARTICLE_COUNT
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z: Math.random() * 400,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.15,
        size: isAttack ? 2.5 : 1.5 + Math.random(),
        isAttack,
      })
    }
  }

  private tick = () => {
    if (!this.ctx || !this.canvas) return
    this.frameId = requestAnimationFrame(this.tick)

    const ctx = this.ctx
    const w = this.width
    const h = this.height

    ctx.save()
    ctx.scale(this.dpr, this.dpr)
    ctx.clearRect(0, 0, w, h)

    // Scroll-based vertical offset for parallax
    const scrollOffset = this.scrollY * 0.15
    const time = performance.now() * 0.001

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx
      p.y += p.vy + scrollOffset * 0.001
      p.z += p.vz

      // Wrap around edges
      if (p.x < -20) p.x = w + 20
      if (p.x > w + 20) p.x = -20
      if (p.y < -20) p.y = h + 20
      if (p.y > h + 20) p.y = -20
      if (p.z < 0) p.z = 400
      if (p.z > 400) p.z = 0

      // Subtle mouse repulsion
      const dx = p.x - this.mouseX
      const dy = p.y - this.mouseY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 200 && dist > 0) {
        const force = (200 - dist) / 200 * 0.02
        p.vx += (dx / dist) * force
        p.vy += (dy / dist) * force
      }

      // Dampen velocity
      p.vx *= 0.999
      p.vy *= 0.999
    }

    // Draw connections
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i]
      const depthA = 1 - a.z / 500

      for (let j = i + 1; j < this.particles.length; j++) {
        const b = this.particles[j]
        const ddx = a.x - b.x
        const ddy = a.y - b.y
        const dd = Math.sqrt(ddx * ddx + ddy * ddy)

        if (dd < CONNECTION_DISTANCE) {
          const depthB = 1 - b.z / 500
          const alpha = (1 - dd / CONNECTION_DISTANCE) * 0.12 * depthA * depthB

          if (a.isAttack || b.isAttack) {
            ctx.strokeStyle = `rgba(255, 34, 68, ${alpha * 1.5})`
          } else {
            ctx.strokeStyle = `rgba(200, 255, 0, ${alpha})`
          }

          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
    }

    // Draw particles
    for (const p of this.particles) {
      const depth = 1 - p.z / 500
      const size = p.size * depth

      if (p.isAttack) {
        // Red attack nodes — pulse
        const pulse = 0.5 + Math.sin(time * 3 + p.x * 0.01) * 0.3
        ctx.fillStyle = `rgba(255, 34, 68, ${(0.6 + pulse * 0.4) * depth})`

        // Glow
        ctx.shadowColor = 'rgba(255, 34, 68, 0.4)'
        ctx.shadowBlur = 8
      } else {
        ctx.fillStyle = `rgba(200, 255, 0, ${0.4 * depth})`
        ctx.shadowColor = 'rgba(200, 255, 0, 0.15)'
        ctx.shadowBlur = 4
      }

      ctx.beginPath()
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // Draw traveling data pulses along some connections
    const pulseCount = 8
    for (let i = 0; i < pulseCount; i++) {
      const idx = (Math.floor(time * 0.5 + i * 7) % this.particles.length)
      const nextIdx = (idx + 1 + i * 3) % this.particles.length
      const a = this.particles[idx]
      const b = this.particles[nextIdx]
      const dd = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

      if (dd < CONNECTION_DISTANCE * 1.5) {
        const t = ((time * (0.8 + i * 0.1) + i) % 1)
        const px = a.x + (b.x - a.x) * t
        const py = a.y + (b.y - a.y) * t

        ctx.fillStyle = a.isAttack ? 'rgba(255, 34, 68, 0.8)' : 'rgba(200, 255, 0, 0.7)'
        ctx.shadowColor = a.isAttack ? 'rgba(255, 34, 68, 0.5)' : 'rgba(200, 255, 0, 0.4)'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(px, py, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    ctx.restore()
  }

  override render() {
    return html`
      <div class="webgl-wrap" aria-hidden="true">
        <canvas class="webgl-canvas"></canvas>
      </div>
    `
  }
}
