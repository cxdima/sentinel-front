import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("cta-section")
export class CtaSection extends LitElement {
    override createRenderRoot() {
        return this;
    }

    override render() {
        return html`
      <section class="cta-section parallax-container" id="cta" aria-labelledby="cta-heading">
        <div class="parallax-grid" aria-hidden="true"></div>
        <div class="cta-section__glow" aria-hidden="true"></div>

        <div class="cta-section__inner">
          <div class="cta-section__label cta-reveal">THE FIRST BLOCKCHAIN RECORD OF WHAT DIDN'T HAPPEN</div>
          <h2 id="cta-heading" class="cta-section__title cta-reveal cta-reveal--title">JOIN THE <span class="cta-section__title--accent">IMMUNITY NETWORK</span></h2>
          <p class="cta-section__body cta-reveal cta-reveal--body">
            12 protocols trust SENTINEL. Every new member strengthens the entire network.<br>
            Autonomous defense. Cryptographic proof. Network-wide immunity.
          </p>

          <div class="cta-section__stats cta-reveal cta-reveal--body">
            <div class="cta-stat">
              <div class="cta-stat__val">12</div>
              <div class="cta-stat__key">PROTOCOLS</div>
            </div>
            <div class="cta-stat">
              <div class="cta-stat__val">$21M+</div>
              <div class="cta-stat__key">PROTECTED</div>
            </div>
            <div class="cta-stat">
              <div class="cta-stat__val">47</div>
              <div class="cta-stat__key">THREATS STOPPED</div>
            </div>
          </div>

          <div class="cta-section__buttons cta-reveal cta-reveal--buttons">
            <a href="#/demo" class="btn btn--primary btn--lg"
              @click=${(e: Event) => {
                  e.preventDefault();
                  window.location.hash = "#/demo";
              }}>LAUNCH LIVE DEMO</a>
            <a href="#/dashboard" class="btn btn--ghost btn--lg"
              @click=${(e: Event) => {
                  e.preventDefault();
                  window.location.hash = "#/dashboard";
              }}>VIEW DASHBOARD</a>
          </div>
        </div>

        <span class="section-num" aria-hidden="true">08 / 08</span>
      </section>
    `;
    }
}
