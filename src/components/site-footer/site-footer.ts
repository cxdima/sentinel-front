import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import "./site-footer.css";

@customElement("site-footer")
export class SiteFooter extends LitElement {
    override createRenderRoot() {
        return this;
    }

    private readonly date = new Date().toISOString().slice(0, 10);

    override render() {
        return html`
      <footer class="site-footer" role="contentinfo">
        <div class="site-footer__top">
          <div class="site-footer__brand">
            <svg class="site-footer__logo" width="28" height="28" viewBox="0 0 22 22" aria-hidden="true">
              <line x1="11" y1="0"  x2="11" y2="22" stroke="#c8ff00" stroke-width="1" opacity="0.7"/>
              <line x1="0"  y1="11" x2="22" y2="11" stroke="#c8ff00" stroke-width="1" opacity="0.7"/>
              <circle cx="11" cy="11" r="6" fill="none" stroke="#c8ff00" stroke-width="1" opacity="0.5"/>
              <circle cx="11" cy="11" r="2" fill="#c8ff00" opacity="0.9"/>
            </svg>
            <div>
              <div class="site-footer__wordmark">SENTINEL V2.0</div>
              <div class="site-footer__tagline">AUTONOMOUS ON-CHAIN DEFENSE</div>
            </div>
          </div>

          <div class="site-footer__links">
            <a href="#problem" class="site-footer__link">THE PROBLEM</a>
            <a href="#how" class="site-footer__link">HOW IT WORKS</a>
            <a href="#compare" class="site-footer__link">COMPARISON</a>
            <a href="#sim" class="site-footer__link">SIMULATION</a>
            <a href="#network" class="site-footer__link">NETWORK</a>
          </div>
        </div>

        <div class="site-footer__bottom">
          <div class="site-footer__meta">
            <span>${this.date}</span>
            <span>47.291°N 8.541°E</span>
          </div>

          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" class="site-footer__icon">
            <line x1="9" y1="0"  x2="9" y2="18" stroke="#444" stroke-width="1"/>
            <line x1="0" y1="9"  x2="18" y2="9"  stroke="#444" stroke-width="1"/>
            <circle cx="9" cy="9" r="5" fill="none" stroke="#444" stroke-width="1"/>
          </svg>

          <div class="site-footer__meta site-footer__meta--right">
            <span>POWERED BY RISC0 ZK PROOFS</span>
            <span>ANVIL:8545 · CHAIN ID 31337</span>
          </div>
        </div>
      </footer>
    `;
    }
}
