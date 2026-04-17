import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'

@customElement('landing-page')
export class LandingPage extends LitElement {
  override createRenderRoot() { return this }

  override render() {
    return html`
      <webgl-bg></webgl-bg>
      <blur-overlay></blur-overlay>
      <hero-section></hero-section>
      <marquee-ticker variant="alert"></marquee-ticker>
      <scrolly-section></scrolly-section>
      <div class="section-divider" aria-hidden="true"></div>
      <how-section></how-section>
      <marquee-ticker></marquee-ticker>
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
    `
  }
}
