import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("landing-page")
export class LandingPage extends LitElement {
    override createRenderRoot() {
        return this;
    }

    override render() {
        return html`
      <webgl-bg></webgl-bg>
      <blur-overlay></blur-overlay>
      <hero-section></hero-section>
      <div class="protocol-strip" aria-label="Currently protecting">
        <span class="protocol-strip__label">CURRENTLY PROTECTING</span>
        <div class="protocol-strip__list" aria-hidden="true">
          <span class="protocol-strip__item">AAVE</span>
          <span class="protocol-strip__dot"></span>
          <span class="protocol-strip__item">UNISWAP</span>
          <span class="protocol-strip__dot"></span>
          <span class="protocol-strip__item">CURVE</span>
          <span class="protocol-strip__dot"></span>
          <span class="protocol-strip__item">MAKER</span>
          <span class="protocol-strip__dot"></span>
          <span class="protocol-strip__item">LIDO</span>
          <span class="protocol-strip__dot"></span>
          <span class="protocol-strip__item">COMPOUND</span>
          <span class="protocol-strip__dot"></span>
          <span class="protocol-strip__item protocol-strip__item--more">+6 MORE</span>
        </div>
      </div>
      <marquee-ticker variant="alert"></marquee-ticker>
      <scrolly-section></scrolly-section>
      <div class="section-divider" aria-hidden="true"></div>
      <how-section></how-section>
      <timeline-compare></timeline-compare>
      <div class="section-divider" aria-hidden="true"></div>
      <compare-table></compare-table>
      <div class="section-divider" aria-hidden="true"></div>
      <trust-sim></trust-sim>
      <div class="section-divider" aria-hidden="true"></div>
      <immunity-map></immunity-map>
      <marquee-ticker></marquee-ticker>
      <cta-section></cta-section>
      <site-footer></site-footer>
      <scroll-guide></scroll-guide>
    `;
    }
}
