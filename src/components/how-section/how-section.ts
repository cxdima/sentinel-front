import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { scrollProgress, subRange } from '../../utils/scroll'

@customElement('how-section')
export class HowSection extends LitElement {
  override createRenderRoot() { return this }

  @state() private cardReveal = 0
  private ticking = false

  private readonly onScroll = () => {
    if (this.ticking) return
    this.ticking = true
    requestAnimationFrame(() => {
      const section = this.querySelector<HTMLElement>('.how-scrolly')
      if (section) {
        this.cardReveal = scrollProgress(section)
      }
      this.ticking = false
    })
  }

  override connectedCallback() {
    super.connectedCallback()
    window.addEventListener('scroll', this.onScroll, { passive: true })
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('scroll', this.onScroll)
  }

  override render() {
    const card1In = subRange(this.cardReveal, 0.05, 0.25)
    const card2In = subRange(this.cardReveal, 0.25, 0.50)
    const card3In = subRange(this.cardReveal, 0.50, 0.75)
    const headerIn = subRange(this.cardReveal, 0, 0.15)

    return html`
      <section class="how-scrolly" id="how" aria-labelledby="how-heading">
        <div class="how-scrolly__sticky">
          <span class="section-num" aria-hidden="true">02 / 08</span>
          <div class="how-scrolly__content">
            <header
              class="section__header"
              style="opacity: ${headerIn}; transform: translateY(${(1 - headerIn) * 40}px)"
            >
              <h2 id="how-heading" class="section__label" data-scramble="HOW IT WORKS">HOW IT WORKS</h2>
              <span class="section__code">// DETECT · RESPOND · PROVE</span>
            </header>

            <div class="how-grid" style="position:relative">
              <svg class="how-flow-svg" viewBox="0 0 1200 10" preserveAspectRatio="none" aria-hidden="true">
                <line class="how-flow-line" x1="0" y1="5" x2="1200" y2="5"
                  stroke="#c8ff00" stroke-width="2" stroke-dasharray="1200"
                  stroke-dashoffset="1200" opacity="0.3"/>
              </svg>

              <!-- Card 1: slides in from left -->
              <div style="opacity: ${card1In}; transform: translateX(${(1 - card1In) * -80}px)">
                <feature-card num="01" title="DETECT" icon="crosshair">
                  <span slot="body">Monitors every transaction in the mempool before it's mined. Flash loans, oracle manipulation, reentrancy — flagged in milliseconds, not minutes.</span>
                  <span slot="tags">
                    <span class="detail-tag">MEMPOOL SCANNING</span>
                    <span class="detail-tag">ML BEHAVIORAL MODELS</span>
                    <span class="detail-tag">&lt;200ms DETECTION</span>
                  </span>
                </feature-card>
              </div>

              <!-- Card 2: slides in from bottom -->
              <div style="opacity: ${card2In}; transform: translateY(${(1 - card2In) * 60}px)">
                <feature-card num="02" title="RESPOND" icon="alert">
                  <span slot="body">Executes defense automatically on-chain — no human approval needed. Pauses contracts, caps withdrawals, or reroutes funds within the same block as the attack.</span>
                  <span slot="tags">
                    <span class="detail-tag">SAME-BLOCK DEFENSE</span>
                    <span class="detail-tag">AUTONOMOUS EXECUTION</span>
                    <span class="detail-tag">POLICY-BOUNDED AI</span>
                  </span>
                </feature-card>
              </div>

              <!-- Card 3: slides in from right -->
              <div style="opacity: ${card3In}; transform: translateX(${(1 - card3In) * 80}px)">
                <feature-card num="03" title="PROVE" icon="check">
                  <span slot="body">Every action generates a zero-knowledge proof, verified on-chain. Shows exactly how much was saved by simulating what would have happened without defense.</span>
                  <span slot="tags">
                    <span class="detail-tag">RISC0 ZK PROOFS</span>
                    <span class="detail-tag">COUNTERFACTUAL LEDGER</span>
                    <span class="detail-tag">PERMANENT AUDIT TRAIL</span>
                  </span>
                </feature-card>
              </div>
            </div>
          </div>
        </div>
        <div class="how-scrolly__spacer" aria-hidden="true"></div>
      </section>
    `
  }
}
