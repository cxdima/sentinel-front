import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { observeViewport } from "../../utils/scroll";
import "./scrolly-section.css";

const ATTACKS = [
    { hash: "0x7a3f…e91c", type: "FLASH LOAN ORACLE", amount: "$2.4M", protocol: "EULER FINANCE" },
    { hash: "0x9c8e…12bb", type: "PRICE MANIPULATION", amount: "$5.1M", protocol: "CREAM FINANCE" },
    { hash: "0xd4f1…7c3e", type: "GOVERNANCE ATTACK", amount: "$12.7M", protocol: "BEANSTALK" },
    { hash: "0x2b1d…f04a", type: "REENTRANCY", amount: "$0.89M", protocol: "REENTRANCY DAO" },
    { hash: "0xf8a2…c391", type: "BRIDGE EXPLOIT", amount: "$624M", protocol: "RONIN BRIDGE" },
    { hash: "0x3c91…a7b2", type: "ORACLE MANIPULATION", amount: "$130M", protocol: "MANGO MARKETS" },
];

@customElement("scrolly-section")
export class ScrollySection extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private lossNum = "$0.0B";
    @state() private attackIdx = 0;

    private ticking = false;
    private inView = false;
    private disposeObserver: (() => void) | null = null;

    private readonly onScroll = () => {
        if (!this.inView || this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            this.updateProgress();
            this.ticking = false;
        });
    };

    private updateProgress() {
        const section = this.querySelector<HTMLElement>(".scrolly-section");
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const scrolled = -rect.top;
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;

        const total = section.offsetHeight - window.innerHeight;
        const progress = Math.max(0, Math.min(1, scrolled / total));

        const newLoss = "$" + (progress * 4.1).toFixed(1) + "B";
        const newIdx = Math.min(ATTACKS.length - 1, Math.floor(progress * ATTACKS.length));

        if (newLoss !== this.lossNum) this.lossNum = newLoss;
        if (newIdx !== this.attackIdx) this.attackIdx = newIdx;
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
      <section
        class="scrolly-section"
        id="problem"
        data-scrolly="true"
        aria-label="DeFi exploit losses"
      >
        <div class="scrolly-section__sticky">
          <span class="section-num" aria-hidden="true">01 / 08</span>
          <div class="scrolly-step-indicator" aria-hidden="true">
            ${ATTACKS.map(
                (_, i) => html`
              <span class="scrolly-step-dot ${i <= this.attackIdx ? "scrolly-step-dot--active" : ""}"></span>
            `,
            )}
          </div>
          <div class="scrolly-bg">
            <div class="scrolly-bg__label">2023 — REAL DeFi EXPLOIT LOSSES</div>
            <div class="scrolly-bg__number">${this.lossNum}</div>
            <div class="scrolly-bg__subtitle">AND COUNTING</div>
            <div class="scrolly-bg__attacks">
              ${ATTACKS.map(
                  (a, i) => html`
                <div class="scrolly-attack-row ${i <= this.attackIdx ? "scrolly-attack-row--visible" : ""}">
                  <span class="scrolly-attack-row__hash">${a.hash}</span>
                  <span class="scrolly-attack-row__type">${a.type}</span>
                  <span class="scrolly-attack-row__amount">${a.amount}</span>
                  <span class="scrolly-attack-row__protocol">${a.protocol}</span>
                </div>
              `,
              )}
            </div>
          </div>
        </div>

        <div class="scrolly-section__spacer" aria-hidden="true"></div>
      </section>
    `;
    }
}
