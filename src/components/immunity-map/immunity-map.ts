import { LitElement, html, svg } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { scrollProgress, subRange } from '../../utils/scroll'
import './immunity-map.css'

const PROTOCOLS = [
  { name: 'Aave',    short: 'AAVE' },
  { name: 'Uniswap', short: 'UNI' },
  { name: 'Maker',   short: 'MKR' },
  { name: 'Lido',    short: 'LIDO' },
  { name: 'Curve',   short: 'CRV' },
  { name: 'Compound',short: 'COMP' },
]

const CX = 160, CY = 140, R = 95

@customElement('immunity-map')
export class ImmunityMap extends LitElement {
  override createRenderRoot() { return this }

  @state() private pulsingIdx = -1
  @state() private shielded = false
  @state() private sectionProgress = 0

  private intervalId = 0
  private ticking = false

  private readonly onScroll = () => {
    if (this.ticking) return
    this.ticking = true
    requestAnimationFrame(() => {
      const section = this.querySelector<HTMLElement>('.imm-scrolly')
      if (section) {
        this.sectionProgress = scrollProgress(section)
      }
      this.ticking = false
    })
  }

  override connectedCallback() {
    super.connectedCallback()
    window.addEventListener('scroll', this.onScroll, { passive: true })
    this.intervalId = window.setInterval(() => this.pulse(), 4500)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('scroll', this.onScroll)
    clearInterval(this.intervalId)
  }

  private pulse() {
    const origin = Math.floor(Math.random() * PROTOCOLS.length)
    this.pulsingIdx = origin
    this.shielded = false

    setTimeout(() => {
      this.shielded = true
    }, 1200)

    setTimeout(() => {
      this.pulsingIdx = -1
      this.shielded = false
    }, 3500)
  }

  private nodePos(i: number) {
    const a = (i / PROTOCOLS.length) * Math.PI * 2 - Math.PI / 2
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }
  }

  private renderSvg() {
    return svg`
      <svg class="imm-svg" viewBox="0 0 320 280" role="img" aria-label="Protocol immunity network">
        <defs>
          <radialGradient id="hub-glow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#c8ff00" stop-opacity="0.06"/>
            <stop offset="100%" stop-color="#c8ff00" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <!-- Hub glow -->
        <circle cx=${CX} cy=${CY} r="70" fill="url(#hub-glow2)"/>

        <!-- Spokes to hub -->
        ${PROTOCOLS.map((_, i) => {
          const p = this.nodePos(i)
          const active = i === this.pulsingIdx
          return svg`
            <line x1=${p.x.toFixed(1)} y1=${p.y.toFixed(1)} x2=${CX} y2=${CY}
              stroke=${active ? '#c8ff00' : '#1a1a1a'}
              stroke-width=${active ? '1' : '0.4'}
              stroke-dasharray=${active ? 'none' : '2 4'}
              opacity=${active ? '0.8' : '1'}
            >
              ${active ? svg`<animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="1.5s" fill="freeze"/>` : ''}
            </line>
          `
        })}

        <!-- Propagation ring from hub -->
        ${this.shielded ? svg`
          <circle cx=${CX} cy=${CY} r="18" fill="none" stroke="#c8ff00" stroke-width="1.5">
            <animate attributeName="r" from="18" to="${R + 15}" dur="1.2s" fill="freeze"/>
            <animate attributeName="opacity" from="0.8" to="0" dur="1.2s" fill="freeze"/>
          </circle>
        ` : ''}

        <!-- Hub -->
        <circle cx=${CX} cy=${CY} r="18" fill="rgba(200,255,0,0.04)" stroke="#c8ff00" stroke-width="1"/>
        <text x=${CX} y=${CY - 2} text-anchor="middle"
          fill="#c8ff00" font-size="7" font-family="'IBM Plex Mono',monospace"
          font-weight="700" letter-spacing="0.1em">SNTL</text>
        <text x=${CX} y=${CY + 8} text-anchor="middle"
          fill="#666" font-size="5" font-family="'IBM Plex Mono',monospace">HUB</text>

        <!-- Protocol nodes -->
        ${PROTOCOLS.map((proto, i) => {
          const p = this.nodePos(i)
          const isOrigin = i === this.pulsingIdx
          const isShielded = this.shielded && i !== this.pulsingIdx

          return svg`
            <g>
              ${isOrigin ? svg`
                <circle cx=${p.x.toFixed(1)} cy=${p.y.toFixed(1)} r="14"
                  fill="none" stroke="#ff2244" stroke-width="1.5" opacity="0.6">
                  <animate attributeName="r" from="14" to="28" dur="1.2s" fill="freeze"/>
                  <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" fill="freeze"/>
                </circle>
              ` : ''}
              ${isShielded ? svg`
                <circle cx=${p.x.toFixed(1)} cy=${p.y.toFixed(1)} r="14"
                  fill="none" stroke="#c8ff00" stroke-width="1" opacity="0.8">
                  <animate attributeName="opacity" from="0" to="0.8" dur="0.4s" fill="freeze"/>
                </circle>
              ` : ''}
              <rect
                x=${(p.x - 13).toFixed(1)} y=${(p.y - 13).toFixed(1)}
                width="26" height="26"
                fill=${isOrigin ? 'rgba(255,34,68,0.06)' : isShielded ? 'rgba(200,255,0,0.04)' : '#000'}
                stroke=${isOrigin ? '#ff2244' : isShielded ? '#c8ff00' : '#2a2a2a'}
                stroke-width=${isOrigin || isShielded ? '1.2' : '0.6'}
              />
              <text x=${p.x.toFixed(1)} y=${(p.y + 3).toFixed(1)}
                text-anchor="middle"
                fill=${isOrigin ? '#ff2244' : isShielded ? '#c8ff00' : '#888'}
                font-size="6" font-family="'IBM Plex Mono',monospace"
                font-weight="600" letter-spacing="0.05em"
              >${proto.short}</text>
            </g>
          `
        })}
      </svg>
    `
  }

  override render() {
    const headerIn = subRange(this.sectionProgress, 0, 0.15)
    const leftIn = subRange(this.sectionProgress, 0.08, 0.35)
    const rightIn = subRange(this.sectionProgress, 0.15, 0.45)
    const stepsIn = subRange(this.sectionProgress, 0.35, 0.65)

    return html`
      <section class="imm-scrolly" id="network" aria-labelledby="net-heading">
        <div class="imm-scrolly__sticky">
          <span class="section-num" aria-hidden="true">06 / 08</span>
          <div class="imm-scrolly__content">
            <header
              class="section__header"
              style="opacity: ${headerIn}; transform: translateY(${(1 - headerIn) * 30}px)"
            >
              <h2 id="net-heading" class="section__label">IMMUNITY NETWORK</h2>
              <span class="section__code">// ONE ATTACK PROTECTS EVERYONE</span>
            </header>

            <div class="imm-layout">
              <!-- Left: slides in from left -->
              <div
                class="panel imm-viz-panel"
                style="opacity: ${leftIn}; transform: translateX(${(1 - leftIn) * -80}px)"
              >
                <div class="panel-header">
                  <span class="panel-label">NETWORK MESH — LIVE</span>
                  <span class="panel-code">
                    <span class="status-dot" aria-hidden="true"></span>
                    ${PROTOCOLS.length} PROTOCOLS
                  </span>
                </div>
                <div class="imm-svg-wrap">
                  ${this.renderSvg()}
                </div>
              </div>

              <!-- Right: slides in from right -->
              <div
                class="imm-right"
                style="opacity: ${rightIn}; transform: translateX(${(1 - rightIn) * 80}px)"
              >
                <div class="imm-headline">
                  <div class="imm-headline__tag">THE CORE IDEA</div>
                  <h3 class="imm-headline__title">Attack one protocol.<br>Immunize them all.</h3>
                  <p class="imm-headline__body">
                    When SENTINEL neutralizes a threat, the attack signature is instantly shared across every connected protocol. The same exploit can never work twice.
                  </p>
                </div>

                <div class="imm-steps" style="opacity: ${stepsIn}; transform: translateY(${(1 - stepsIn) * 30}px)">
                  <div class="imm-step">
                    <div class="imm-step__icon" style="color:#ff2244; border-color:#ff2244">!</div>
                    <div class="imm-step__text"><strong>Attack detected</strong> on one protocol</div>
                  </div>
                  <div class="imm-step__arrow" aria-hidden="true">&darr;</div>
                  <div class="imm-step">
                    <div class="imm-step__icon" style="color:#c8ff00; border-color:#c8ff00">#</div>
                    <div class="imm-step__text"><strong>Signature published</strong> to ThreatRegistry</div>
                  </div>
                  <div class="imm-step__arrow" aria-hidden="true">&darr;</div>
                  <div class="imm-step">
                    <div class="imm-step__icon" style="color:#36c88b; border-color:#36c88b">&check;</div>
                    <div class="imm-step__text"><strong>All protocols immune</strong> — in ~2 seconds</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="imm-scrolly__spacer" aria-hidden="true"></div>
      </section>
    `
  }
}
