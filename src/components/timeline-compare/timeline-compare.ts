import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { observeViewport, scrollProgress } from "../../utils/scroll";
import "./timeline-compare.css";

const WITHOUT_STEPS = [
    { label: "ATTACK BEGINS", time: "0s", marker: "!", color: "#ff2244" },
    { label: "FLASH LOAN EXECUTES", time: "+2s", marker: "$", color: "#ff2244" },
    { label: "ORACLE MANIPULATED", time: "+5s", marker: "X", color: "#ff2244" },
    { label: "FUNDS DRAINED", time: "+13s", marker: "0", color: "#ff2244" },
    { label: "TEAM ALERTED", time: "+4h", marker: "?", color: "#d47d27" },
    { label: "POST-MORTEM", time: "+48h", marker: "~", color: "#666" },
];

const WITH_STEPS = [
    { label: "ATTACK BEGINS", time: "0s", marker: "!", color: "#d47d27" },
    { label: "MEMPOOL DETECTED", time: "+200ms", marker: "*", color: "#c8ff00" },
    { label: "DEFENSE EXECUTED", time: "+340ms", marker: "#", color: "#36c88b" },
    { label: "PROOF GENERATED", time: "+1.2s", marker: "&", color: "#36c88b" },
    { label: "FUNDS SAFE ON-CHAIN", time: "+2s", marker: "+", color: "#c8ff00" },
    { label: "NETWORK IMMUNIZED", time: "+4s", marker: "@", color: "#c8ff00" },
];

@customElement("timeline-compare")
export class TimelineCompare extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private progress = 0;
    private ticking = false;
    private inView = false;
    private disposeObserver: (() => void) | null = null;

    private readonly onScroll = () => {
        if (!this.inView || this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            const section = this.querySelector<HTMLElement>(".tl-compare");
            if (section) {
                const next = scrollProgress(section);
                if (Math.abs(next - this.progress) > 0.001) this.progress = next;
            }
            this.ticking = false;
        });
    };

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

    private renderTimeline(steps: typeof WITHOUT_STEPS, fromRight = false) {
        const stepsVisible = Math.floor(this.progress * 8);
        return steps.map((step, i) => {
            const visible = i < stepsVisible;
            const direction = fromRight ? "translateX(20px)" : "translateX(-20px)";
            return html`
        <div
          class="tl-step ${visible ? "tl-step--visible" : ""}"
          style="transition-delay: ${i * 0.12}s; ${!visible ? `transform: ${direction}` : ""}"
        >
          <div class="tl-step__marker" style="color: ${step.color}; border-color: ${step.color}">${step.marker}</div>
          <div class="tl-step__content">
            <div class="tl-step__label" style="color: ${step.color}">${step.label}</div>
            <div class="tl-step__time">${step.time}</div>
          </div>
        </div>
      `;
        });
    }

    override render() {
        const withReveal = this.progress > 0.3;
        const deltaReveal = this.progress > 0.7;

        return html`
      <section class="tl-compare" id="compare" aria-labelledby="compare-heading">
        <div class="tl-compare__sticky">
          <span class="section-num" aria-hidden="true">03 / 08</span>
          <div class="tl-compare__content">
            <header class="section__header" style="margin-bottom: 16px">
              <h2 id="compare-heading" class="section__label">TWO REALITIES</h2>
              <span class="section__code">// SAME ATTACK · DIFFERENT OUTCOMES</span>
            </header>

            <div class="tl-compare__grid">
              <div class="tl-compare__col tl-compare__col--without">
                <div class="tl-compare__col-header">
                  <div class="tl-compare__col-dot" style="background: #ff2244; box-shadow: 0 0 12px rgba(255,34,68,0.5)"></div>
                  <span class="tl-compare__col-title">WITHOUT SENTINEL</span>
                </div>
                <div class="tl-compare__steps">
                  ${this.renderTimeline(WITHOUT_STEPS)}
                </div>
                <div class="tl-compare__result ${deltaReveal ? "tl-compare__result--visible" : ""}">
                  <div class="tl-compare__result-val" style="color: #ff2244">-$2,400,000</div>
                  <div class="tl-compare__result-label">FUNDS LOST</div>
                </div>
              </div>

              <div class="tl-compare__divider">
                <div class="tl-compare__divider-line"></div>
                <div class="tl-compare__divider-label">VS</div>
                <div class="tl-compare__divider-line"></div>
              </div>

              <div class="tl-compare__col tl-compare__col--with ${withReveal ? "tl-compare__col--active" : ""}">
                <div class="tl-compare__col-header">
                  <div class="tl-compare__col-dot" style="background: #c8ff00; box-shadow: 0 0 12px rgba(200,255,0,0.5)"></div>
                  <span class="tl-compare__col-title" style="color: #c8ff00">WITH SENTINEL</span>
                </div>
                <div class="tl-compare__steps">
                  ${this.renderTimeline(WITH_STEPS, true)}
                </div>
                <div class="tl-compare__result ${deltaReveal ? "tl-compare__result--visible" : ""}">
                  <div class="tl-compare__result-val" style="color: #c8ff00">$0 LOST</div>
                  <div class="tl-compare__result-label">FUNDS PROTECTED + PROVEN ON-CHAIN</div>
                </div>
              </div>
            </div>

            <div class="tl-compare__delta ${deltaReveal ? "tl-compare__delta--visible" : ""}">
              <div class="tl-compare__delta-label">PREVENTED LOSS</div>
              <div class="tl-compare__delta-value">$2,400,000</div>
              <div class="tl-compare__delta-proof">ZK PROOF COMMITTED TO CHAIN AT BLOCK #19284531</div>
            </div>
          </div>
        </div>
        <div class="tl-compare__spacer" aria-hidden="true"></div>
      </section>
    `;
    }
}
