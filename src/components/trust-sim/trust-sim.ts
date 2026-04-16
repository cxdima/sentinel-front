import { LitElement, html, svg } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import './trust-sim.css'

type Phase = 'idle' | 'scanning' | 'suspicion' | 'proof' | 'resolved'

const PHASE_META: Record<Phase, { label: string; color: string }> = {
  idle:      { label: 'STANDBY',     color: '#444444' },
  scanning:  { label: 'SCANNING',    color: '#00d9ff' },
  suspicion: { label: 'THREAT DETECTED', color: '#ff2244' },
  proof:     { label: 'VERIFYING',   color: '#d47d27' },
  resolved:  { label: 'DEFENDED',    color: '#c8ff00' },
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

@customElement('trust-sim')
export class TrustSim extends LitElement {
  override createRenderRoot() { return this }

  @state() private phase: Phase = 'idle'
  @state() private scanProgress = 0
  @state() private scanLines: number[] = []
  @state() private threatNodes: boolean[] = [false, false, false, false, false]
  @state() private proofSteps: boolean[] = [false, false, false]
  @state() private savedAmount = '$0'
  @state() private proofHash = ''

  private get dotColor() { return PHASE_META[this.phase].color }
  private get phaseLabel() { return PHASE_META[this.phase].label }

  private async runSequence() {
    if (this.phase !== 'idle') return

    // Phase 1: Scanning the mempool
    this.phase = 'scanning'
    this.scanLines = []
    for (let i = 0; i <= 100; i += 2) {
      this.scanProgress = i
      if (i % 10 === 0) this.scanLines = [...this.scanLines, i]
      await delay(40)
    }

    await delay(800)

    // Phase 2: Threat detected — reveal each indicator slowly
    this.phase = 'suspicion'
    for (let i = 0; i < 5; i++) {
      await delay(700)
      this.threatNodes = this.threatNodes.map((_, j) => j <= i)
    }

    await delay(1200)

    // Phase 3: Proving — verify each step deliberately
    this.phase = 'proof'
    const hashChars = '0123456789abcdef'
    for (let i = 0; i < 3; i++) {
      await delay(1200)
      this.proofSteps = this.proofSteps.map((_, j) => j <= i)
    }

    // Animate proof hash generation — character by character
    let hash = ''
    for (let i = 0; i < 16; i++) {
      hash += hashChars[Math.floor(Math.random() * 16)]
      this.proofHash = '0x' + hash + '…'
      await delay(70)
    }

    await delay(800)

    // Animate saved amount counter
    const target = 2400000
    const frames = 40
    for (let i = 1; i <= frames; i++) {
      const eased = 1 - Math.pow(1 - i / frames, 4)
      const val = Math.round(eased * target)
      this.savedAmount = '$' + val.toLocaleString()
      await delay(35)
    }

    await delay(600)
    this.phase = 'resolved'
  }

  private reset() {
    this.phase = 'idle'
    this.scanProgress = 0
    this.scanLines = []
    this.threatNodes = [false, false, false, false, false]
    this.proofSteps = [false, false, false]
    this.savedAmount = '$0'
    this.proofHash = ''
  }

  private renderSvgViz() {
    const isScanning = this.phase === 'scanning'
    const isThreat = this.phase === 'suspicion'
    const isProof = this.phase === 'proof'
    const isResolved = this.phase === 'resolved'

    const nodePositions = [
      { x: 60, y: 40, label: 'POOL' },
      { x: 180, y: 30, label: 'ORACL' },
      { x: 300, y: 50, label: 'VAULT' },
      { x: 120, y: 110, label: 'DEX' },
      { x: 240, y: 120, label: 'LEND' },
    ]

    const edges = [[0,1],[1,2],[0,3],[3,4],[1,4],[2,4]]

    return svg`
      <svg class="trust-viz" viewBox="0 0 360 160" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="ts-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#111" stroke-width="0.3"/>
          </pattern>
          <filter id="ts-glow-green">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="ts-glow-red">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="scan-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="transparent"/>
            <stop offset="50%" stop-color="#00d9ff"/>
            <stop offset="100%" stop-color="transparent"/>
          </linearGradient>
        </defs>
        <rect width="360" height="160" fill="url(#ts-grid)"/>

        <!-- Edges -->
        ${edges.map(([a, b]) => {
          const n1 = nodePositions[a], n2 = nodePositions[b]
          const edgeColor = isResolved ? '#c8ff00' : isThreat ? '#ff2244' : '#222'
          return svg`
            <line x1=${n1.x} y1=${n1.y} x2=${n2.x} y2=${n2.y}
              stroke=${edgeColor} stroke-width="0.6" stroke-dasharray="3 4"
              opacity=${isResolved ? '0.6' : isThreat ? '0.4' : '0.3'}>
              ${(isThreat || isResolved) ? svg`
                <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.5s" repeatCount="indefinite"/>
              ` : ''}
            </line>
          `
        })}

        <!-- Attack path highlight -->
        ${isThreat ? svg`
          <line x1="60" y1="40" x2="180" y2="30" stroke="#ff2244" stroke-width="2" opacity="0.8"
            filter="url(#ts-glow-red)">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="0.8s" repeatCount="indefinite"/>
          </line>
          <line x1="180" y1="30" x2="300" y2="50" stroke="#ff2244" stroke-width="2" opacity="0.8"
            filter="url(#ts-glow-red)">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="0.8s" repeatCount="indefinite" begin="0.2s"/>
          </line>
        ` : ''}

        <!-- Scan line -->
        ${isScanning ? svg`
          <rect x="0" y=${(this.scanProgress / 100) * 150} width="360" height="3"
            fill="url(#scan-grad)" opacity="0.8"/>
        ` : ''}

        <!-- Nodes -->
        ${nodePositions.map((n, i) => {
          const active = this.threatNodes[i]
          const nodeColor = isResolved ? '#c8ff00'
            : (isThreat && active) ? '#ff2244'
            : (isProof && active) ? '#d47d27'
            : isScanning ? '#00d9ff'
            : '#333'
          return svg`
            <g>
              ${(isThreat && active) ? svg`
                <circle cx=${n.x} cy=${n.y} r="14" fill="none" stroke="#ff2244" stroke-width="1">
                  <animate attributeName="r" from="14" to="28" dur="1s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite"/>
                </circle>
              ` : ''}
              ${isResolved ? svg`
                <circle cx=${n.x} cy=${n.y} r="14" fill="none" stroke="#c8ff00" stroke-width="0.8" opacity="0.3"/>
              ` : ''}
              <rect x=${n.x - 10} y=${n.y - 10} width="20" height="20"
                fill="#000" stroke=${nodeColor} stroke-width=${active || isResolved ? '1.5' : '0.6'}/>
              <text x=${n.x} y=${n.y + 3} text-anchor="middle"
                fill=${nodeColor} font-size="5" font-family="'IBM Plex Mono',monospace"
                font-weight="600" letter-spacing="0.06em">${n.label}</text>
            </g>
          `
        })}

        <!-- Shield icon when resolved -->
        ${isResolved ? svg`
          <g transform="translate(180, 80)" filter="url(#ts-glow-green)">
            <path d="M0,-18 L14,-10 L14,6 L0,18 L-14,6 L-14,-10 Z"
              fill="none" stroke="#c8ff00" stroke-width="1.5"/>
            <path d="M-5,0 L-1,5 L7,-5" fill="none" stroke="#c8ff00" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        ` : ''}
      </svg>
    `
  }

  override render() {
    const isActive = this.phase !== 'idle'

    return html`
      <section class="section trust-section" id="sim" aria-labelledby="sim-heading">
        <span class="section-num" aria-hidden="true">05 / 08</span>
        <header class="section__header">
          <h2 id="sim-heading" class="section__label reveal">LIVE SIMULATION</h2>
          <span class="section__code reveal">// WATCH SENTINEL DEFEND $2.4M IN REAL-TIME</span>
        </header>

        <div class="trust-sim-wrap reveal-scale">
          <article class="panel trust-sim" aria-labelledby="sim-label">
            <div class="panel-header">
              <span class="panel-label" id="sim-label">Trust Interface — Flash Loan Oracle Attack</span>
              <div class="trust-sim__phase-indicator">
                <span class="trust-sim__phase-text">PHASE: ${this.phaseLabel}</span>
                <div
                  class="trust-sim__phase-dot"
                  style="background: ${this.dotColor}; box-shadow: 0 0 12px ${this.dotColor}"
                ></div>
              </div>
            </div>

            <!-- SVG Visualization -->
            <div class="trust-sim__viz ${isActive ? 'trust-sim__viz--active' : ''}">
              ${this.renderSvgViz()}
            </div>

            <div class="trust-sim__body">
              ${this.phase === 'idle' ? this.renderIdle() : ''}
              ${this.phase === 'scanning' ? this.renderScanning() : ''}
              ${this.phase === 'suspicion' ? this.renderThreat() : ''}
              ${this.phase === 'proof' ? this.renderProving() : ''}
              ${this.phase === 'resolved' ? this.renderResolved() : ''}
            </div>
          </article>
        </div>
      </section>
    `
  }

  private renderIdle() {
    return html`
      <div class="trust-idle">
        <div class="trust-idle__icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="18" fill="none" stroke="#222" stroke-width="1" stroke-dasharray="4 3"/>
            <circle cx="24" cy="24" r="4" fill="#333"/>
            <line x1="24" y1="0" x2="24" y2="48" stroke="#222" stroke-width="0.5"/>
            <line x1="0" y1="24" x2="48" y2="24" stroke="#222" stroke-width="0.5"/>
          </svg>
        </div>
        <p class="trust-idle__question">A suspicious transaction appeared at block <strong>#19284531</strong></p>
        <p class="trust-idle__sub">Flash loan → oracle manipulation → vault drain. Classic attack vector.</p>
        <p class="trust-idle__prompt">SHOULD YOU TRUST THE DEFENSE?</p>
        <div class="trust-idle__buttons">
          <button class="btn btn--primary" @click=${this.runSequence}>VERIFY DEFENSE</button>
          <button class="btn btn--ghost" @click=${this.reset}>DISMISS</button>
        </div>
      </div>
    `
  }

  private renderScanning() {
    return html`
      <div class="trust-phase">
        <p class="trust-phase__desc">Sentinel monitors every pending transaction in the mempool, checking for patterns that match known attack vectors.</p>
        <div class="trust-phase__bar">
          <div class="trust-phase__fill trust-phase__fill--cyan" style="width:${this.scanProgress}%"></div>
        </div>
        <div class="trust-phase__grid">
          ${this.scanLines.map(line => html`
            <div class="trust-scan-line">
              <span class="trust-scan-line__addr">0x${Math.random().toString(16).slice(2, 10)}</span>
              <span class="trust-scan-line__label">${line < 40 ? 'NORMAL' : line < 70 ? 'CHECKING' : 'FLAGGED'}</span>
              <span class="trust-scan-line__val ${line > 70 ? 'trust-scan-line__val--warn' : ''}">${(Math.random() * 100).toFixed(1)} ETH</span>
            </div>
          `)}
        </div>
      </div>
    `
  }

  private renderThreat() {
    const threats = [
      { label: 'Flash loan: 50,000 ETH borrowed in a single transaction', severity: 'HIGH' },
      { label: 'Oracle price manipulated 340% within 1 block — impossible under normal conditions', severity: 'CRITICAL' },
      { label: 'Vault drain queued: attacker attempting to withdraw $2.4M using inflated collateral', severity: 'CRITICAL' },
      { label: 'Pattern matches Euler Finance exploit (March 2023, $197M stolen)', severity: 'HIGH' },
      { label: 'Zero-collateral withdrawal path found — this is the attack', severity: 'CRITICAL' },
    ]
    return html`
      <div class="trust-phase">
        <p class="trust-phase__desc">Attack signature detected. Sentinel identified a multi-step exploit chain happening within a single block.</p>
        <div class="trust-threats">
          ${threats.map((t, i) => html`
            <div class="trust-threat ${this.threatNodes[i] ? 'trust-threat--visible' : ''}">
              <span class="trust-threat__severity trust-threat__severity--${t.severity.toLowerCase()}">${t.severity}</span>
              <span class="trust-threat__text">${t.label}</span>
            </div>
          `)}
        </div>
      </div>
    `
  }

  private renderProving() {
    const steps = [
      { label: 'Policy constraint check', detail: 'Verifying that Sentinel\'s response is within its authorized action set — it can only pause, never move funds.' },
      { label: 'Counterfactual simulation', detail: 'Simulating what would have happened without intervention: LOSS = $2,400,000' },
      { label: 'ZK proof generation', detail: this.proofHash || 'Generating a zero-knowledge proof that the defense was legitimate and verifiable on-chain…' },
    ]
    return html`
      <div class="trust-phase">
        <p class="trust-phase__desc trust-phase__desc--accent">Sentinel paused the vault and is now generating cryptographic proof that its action was justified.</p>
        <div class="trust-proofs">
          ${steps.map((s, i) => html`
            <div class="trust-proof ${this.proofSteps[i] ? 'trust-proof--visible' : ''}">
              <div class="trust-proof__check">${this.proofSteps[i] ? '✓' : '○'}</div>
              <div class="trust-proof__content">
                <div class="trust-proof__label">${s.label}</div>
                <div class="trust-proof__detail ${this.proofSteps[i] ? 'trust-proof__detail--done' : ''}">${this.proofSteps[i] ? s.detail : ''}</div>
              </div>
            </div>
          `)}
        </div>
        ${this.proofSteps[2] ? html`
          <div class="trust-saved">
            <div class="trust-saved__label">CAPITAL PRESERVED</div>
            <div class="trust-saved__amount">${this.savedAmount}</div>
          </div>
        ` : ''}
      </div>
    `
  }

  private renderResolved() {
    return html`
      <div class="trust-resolved">
        <div class="trust-resolved__banner">
          <div class="trust-resolved__shield" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <path d="M16,2 L28,8 L28,16 C28,23 22,28 16,30 C10,28 4,23 4,16 L4,8 Z"
                fill="none" stroke="#c8ff00" stroke-width="1.5"/>
              <path d="M10,16 L14,20 L22,12" fill="none" stroke="#c8ff00" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="trust-resolved__title">DEFENSE VERIFIED</div>
        </div>

        <div class="trust-resolved__grid">
          <div class="trust-resolved__row">
            <span class="trust-resolved__key">BLOCK</span>
            <span class="trust-resolved__val">#19284531 — PAUSE EXECUTED</span>
          </div>
          <div class="trust-resolved__row">
            <span class="trust-resolved__key">ATTACK</span>
            <span class="trust-resolved__val">FLASH LOAN ORACLE MANIPULATION</span>
          </div>
          <div class="trust-resolved__row">
            <span class="trust-resolved__key">POLICY</span>
            <span class="trust-resolved__val">0xabcd…1234 VERIFIED ON-CHAIN</span>
          </div>
          <div class="trust-resolved__row">
            <span class="trust-resolved__key">PROOF</span>
            <span class="trust-resolved__val">${this.proofHash} VERIFIED</span>
          </div>
          <div class="trust-resolved__row trust-resolved__row--accent">
            <span class="trust-resolved__key">SAVED</span>
            <span class="trust-resolved__val trust-resolved__val--big">$2,400,000</span>
          </div>
        </div>

        <button class="btn btn--ghost btn--sm" style="margin-top:20px" @click=${this.reset}>RESET SIMULATION</button>
      </div>
    `
  }
}
