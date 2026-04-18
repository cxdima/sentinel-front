import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { observeViewport, scrollProgress, subRange } from "../../utils/scroll";

@customElement("how-section")
export class HowSection extends LitElement {
    override createRenderRoot() {
        return this;
    }

    private ticking = false;
    private inView = false;
    private disposeObserver: (() => void) | null = null;
    private card1El: HTMLElement | null = null;
    private card2El: HTMLElement | null = null;
    private card3El: HTMLElement | null = null;
    private headerEl: HTMLElement | null = null;
    private sectionEl: HTMLElement | null = null;

    private readonly onScroll = () => {
        if (!this.inView || this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            this.ticking = false;
            if (!this.sectionEl) return;
            const p = scrollProgress(this.sectionEl);
            this.apply(p);
        });
    };

    private apply(p: number) {
        const c1 = subRange(p, 0.05, 0.25);
        const c2 = subRange(p, 0.25, 0.5);
        const c3 = subRange(p, 0.5, 0.75);
        const h = subRange(p, 0.0, 0.15);
        if (this.headerEl) {
            this.headerEl.style.opacity = String(h);
            this.headerEl.style.transform = `translateY(${(1 - h) * 40}px)`;
        }
        if (this.card1El) {
            this.card1El.style.opacity = String(c1);
            this.card1El.style.transform = `translateX(${(1 - c1) * -80}px)`;
        }
        if (this.card2El) {
            this.card2El.style.opacity = String(c2);
            this.card2El.style.transform = `translateY(${(1 - c2) * 60}px)`;
        }
        if (this.card3El) {
            this.card3El.style.opacity = String(c3);
            this.card3El.style.transform = `translateX(${(1 - c3) * 80}px)`;
        }
    }

    override firstUpdated() {
        this.sectionEl = this.querySelector<HTMLElement>(".how-scrolly");
        this.headerEl = this.querySelector<HTMLElement>(".how-scrolly__sticky .section__header");
        this.card1El = this.querySelector<HTMLElement>('[data-how-card="1"]');
        this.card2El = this.querySelector<HTMLElement>('[data-how-card="2"]');
        this.card3El = this.querySelector<HTMLElement>('[data-how-card="3"]');
        this.apply(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0);
    }

    override connectedCallback() {
        super.connectedCallback();
        window.addEventListener("scroll", this.onScroll, { passive: true });
        this.disposeObserver = observeViewport(this, (inView) => {
            this.inView = inView;
            if (inView) this.onScroll();
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("scroll", this.onScroll);
        this.disposeObserver?.();
        this.disposeObserver = null;
    }

    override render() {
        return html`
      <section class="how-scrolly" id="how" aria-labelledby="how-heading">
        <div class="how-scrolly__sticky">
          <span class="section-num" aria-hidden="true">02 / 08</span>
          <div class="how-scrolly__content">
            <header class="section__header" style="opacity:0; transform:translateY(40px)">
              <h2 id="how-heading" class="section__label" data-scramble="HOW IT WORKS">HOW IT WORKS</h2>
              <span class="section__code">// DETECT · RESPOND · PROVE</span>
            </header>

            <div class="how-grid" style="position:relative">
              <svg class="how-flow-svg" viewBox="0 0 1200 10" preserveAspectRatio="none" aria-hidden="true">
                <line class="how-flow-line" x1="0" y1="5" x2="1200" y2="5"
                  stroke="#c8ff00" stroke-width="2" stroke-dasharray="1200"
                  stroke-dashoffset="1200" opacity="0.3"/>
              </svg>

              <div data-how-card="1" style="opacity:0; transform:translateX(-80px)">
                <feature-card num="01" title="DETECT" icon="crosshair" code="tx: 0x7a3f…e91c | status: FLAGGED">
                  <span slot="body">Monitors every transaction in the mempool before it's mined. Flash loans, oracle manipulation, reentrancy — flagged in milliseconds, not minutes.</span>
                  <span slot="tags">
                    <span class="detail-tag">MEMPOOL SCANNING</span>
                    <span class="detail-tag">ML BEHAVIORAL MODELS</span>
                    <span class="detail-tag">&lt;200ms DETECTION</span>
                  </span>
                </feature-card>
              </div>

              <div data-how-card="2" style="opacity:0; transform:translateY(60px)">
                <feature-card num="02" title="RESPOND" icon="alert" code="block: #19284531 | action: PAUSE_VAULT">
                  <span slot="body">Executes defense automatically on-chain — no human approval needed. Pauses contracts, caps withdrawals, or reroutes funds within the same block as the attack.</span>
                  <span slot="tags">
                    <span class="detail-tag">SAME-BLOCK DEFENSE</span>
                    <span class="detail-tag">AUTONOMOUS EXECUTION</span>
                    <span class="detail-tag">POLICY-BOUNDED AI</span>
                  </span>
                </feature-card>
              </div>

              <div data-how-card="3" style="opacity:0; transform:translateX(80px)">
                <feature-card num="03" title="PROVE" icon="check" code="proof: risc0::verify | saved: $2.4M">
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
    `;
    }
}
