import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { observeViewport, scrollProgress, subRange } from "../../utils/scroll";
import "./blur-overlay.css";

@customElement("blur-overlay")
export class BlurOverlay extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private revealPct = 100;
    @state() private phaseIdx = 0;
    @state() private slideOutPct = 0;

    private triggerEl: HTMLElement | null = null;
    private ticking = false;
    private inView = false;
    private disposeObserver: (() => void) | null = null;

    override connectedCallback() {
        super.connectedCallback();
        requestAnimationFrame(() => {
            this.triggerEl = document.getElementById("problem");
            window.addEventListener("scroll", this.onScroll, { passive: true });
            if (this.triggerEl) {
                this.disposeObserver = observeViewport(this.triggerEl, (inView) => {
                    this.inView = inView;
                    if (inView) this.onScroll();
                    else if (this.revealPct !== 100) {
                        this.revealPct = 100;
                        this.slideOutPct = 0;
                    }
                });
            }
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("scroll", this.onScroll);
        this.disposeObserver?.();
        this.disposeObserver = null;
    }

    private readonly onScroll = () => {
        if (!this.inView || this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            this.updateScroll();
            this.ticking = false;
        });
    };

    private updateScroll() {
        const section = this.triggerEl;
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const scrolled = -rect.top;

        if (scrolled < 0) {
            if (this.revealPct !== 100) this.revealPct = 100;
            if (this.slideOutPct !== 0) this.slideOutPct = 0;
            return;
        }

        const p = scrollProgress(section);

        let nextReveal = 100;
        let nextSlideOut = 0;
        let nextPhase = 0;

        if (p < 0.12) {
            nextReveal = Math.round(100 - subRange(p, 0, 0.12) * 100);
            nextPhase = 0;
        } else if (p < 0.35) {
            nextReveal = 0;
            nextPhase = 0;
        } else if (p < 0.55) {
            nextReveal = 0;
            nextPhase = 1;
        } else if (p < 0.75) {
            nextReveal = 0;
            nextPhase = 2;
        } else {
            nextReveal = 0;
            nextSlideOut = Math.round(subRange(p, 0.75, 1) * 100);
            nextPhase = 2;
        }

        if (nextReveal !== this.revealPct) this.revealPct = nextReveal;
        if (nextSlideOut !== this.slideOutPct) this.slideOutPct = nextSlideOut;
        if (nextPhase !== this.phaseIdx) this.phaseIdx = nextPhase;
    }

    override render() {
        // Combined transform: reveal from bottom (0..100%) + slide-out upwards (0..100%).
        // Total translateY in % of element height: revealPct (hides) + slideOutPct (slides away upward).
        const totalY = this.revealPct - this.slideOutPct;
        const opacity = this.slideOutPct > 0 ? 1 - this.slideOutPct / 100 : 1;
        const translateStyle = `transform: translateY(${totalY}%); opacity: ${opacity}`;
        const visibleClass = this.revealPct < 100 ? "blur-overlay blur-overlay--visible" : "blur-overlay";

        return html`
      <div
        class=${visibleClass}
        style=${translateStyle}
        aria-hidden="true"
      >
        <div class="blur-overlay__border"></div>
        <div class="blur-overlay__backdrop"></div>

        <div class="blur-overlay__inner">
          <!-- Phase 0: The Problem -->
          <div class="blur-phase ${this.phaseIdx === 0 ? "blur-phase--active" : ""}">
            <div class="blur-phase__tag">THE PROBLEM</div>
            <h3 class="blur-phase__heading">DeFi protocols lose billions because attacks happen faster than humans can respond.</h3>
            <div class="blur-phase__grid">
              <div class="blur-stat">
                <div class="blur-stat__val">$4.1B</div>
                <div class="blur-stat__key">STOLEN IN 2023 ALONE</div>
              </div>
              <div class="blur-stat">
                <div class="blur-stat__val">13s</div>
                <div class="blur-stat__key">AVERAGE ATTACK DURATION</div>
              </div>
              <div class="blur-stat">
                <div class="blur-stat__val">4h+</div>
                <div class="blur-stat__key">FASTEST HUMAN RESPONSE</div>
              </div>
              <div class="blur-stat">
                <div class="blur-stat__val">0</div>
                <div class="blur-stat__key">TOOLS THAT PROVE PREVENTION</div>
              </div>
            </div>
          </div>

          <!-- Phase 1: Why Current Solutions Fail -->
          <div class="blur-phase ${this.phaseIdx === 1 ? "blur-phase--active" : ""}">
            <div class="blur-phase__tag">WHY CURRENT DEFENSES FAIL</div>
            <h3 class="blur-phase__heading">Every existing solution is too slow, too passive, or requires human trust.</h3>
            <div class="blur-phase__rows">
              <div class="blur-row">
                <span class="blur-row__label blur-row__label--red">AUDITS</span>
                <span class="blur-row__val">Check code before deployment — but attacks exploit runtime conditions, not static code</span>
              </div>
              <div class="blur-row">
                <span class="blur-row__label blur-row__label--red">MULTISIG</span>
                <span class="blur-row__val">Requires human signers — a 13-second attack is over before anyone picks up their phone</span>
              </div>
              <div class="blur-row">
                <span class="blur-row__label blur-row__label--red">MONITORING</span>
                <span class="blur-row__val">Can detect and alert — but cannot act autonomously and cannot prove what was prevented</span>
              </div>
              <div class="blur-row">
                <span class="blur-row__label blur-row__label--red">BUG BOUNTIES</span>
                <span class="blur-row__val">Pay after the attack — you're compensating researchers for damage already done</span>
              </div>
            </div>
          </div>

          <!-- Phase 2: The SENTINEL Difference -->
          <div class="blur-phase ${this.phaseIdx === 2 ? "blur-phase--active" : ""}">
            <div class="blur-phase__tag">THE SENTINEL DIFFERENCE</div>
            <h3 class="blur-phase__heading">Detect. Respond. Prove. All within the same block.</h3>
            <div class="blur-phase__grid">
              <div class="blur-stat">
                <div class="blur-stat__val blur-stat__val--accent">340ms</div>
                <div class="blur-stat__key">AVERAGE RESPONSE TIME</div>
              </div>
              <div class="blur-stat">
                <div class="blur-stat__val blur-stat__val--accent">47</div>
                <div class="blur-stat__key">THREATS NEUTRALIZED</div>
              </div>
              <div class="blur-stat">
                <div class="blur-stat__val blur-stat__val--accent">$21M</div>
                <div class="blur-stat__key">CAPITAL PROTECTED</div>
              </div>
              <div class="blur-stat">
                <div class="blur-stat__val blur-stat__val--accent">ZK</div>
                <div class="blur-stat__key">EVERY ACTION PROVEN ON-CHAIN</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    }
}
