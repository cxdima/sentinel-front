import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'

type Route = 'landing' | 'dashboard'

@customElement('app-router')
export class AppRouter extends LitElement {
  override createRenderRoot() { return this }

  @state() private route: Route = 'landing'

  override connectedCallback() {
    super.connectedCallback()
    window.addEventListener('hashchange', this.onHash)
    this.onHash()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('hashchange', this.onHash)
  }

  private readonly onHash = () => {
    const hash = window.location.hash
    const newRoute: Route = hash === '#/dashboard' ? 'dashboard' : 'landing'
    if (newRoute !== this.route) {
      this.route = newRoute
      window.scrollTo(0, 0)
    }
  }

  override render() {
    if (this.route === 'dashboard') {
      return html`<war-room></war-room>`
    }
    return html`<landing-page></landing-page>`
  }
}
