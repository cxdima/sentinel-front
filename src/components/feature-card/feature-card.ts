import { LitElement, TemplateResult, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import "./feature-card.css";

type Icon = "crosshair" | "alert" | "check";

const ICONS: Record<Icon, TemplateResult> = {
    crosshair: html`
    <svg class="feature-card__icon" viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#c8ff00" stroke-width="0.8" opacity="0.3"/>
      <circle cx="40" cy="40" r="18" fill="none" stroke="#c8ff00" stroke-width="1" opacity="0.5"/>
      <circle cx="40" cy="40" r="4" fill="#c8ff00" opacity="0.9"/>
      <line x1="40" y1="4"  x2="40" y2="76" stroke="#c8ff00" stroke-width="0.6" opacity="0.4"/>
      <line x1="4"  y1="40" x2="76" y2="40" stroke="#c8ff00" stroke-width="0.6" opacity="0.4"/>
      <circle cx="40" cy="40" r="30" fill="none" stroke="#c8ff00" stroke-width="1.5" stroke-dasharray="4 8" opacity="0.3"/>
    </svg>`,
    alert: html`
    <svg class="feature-card__icon" viewBox="0 0 80 80" aria-hidden="true">
      <path d="M40 10 L70 65 L10 65 Z" fill="none" stroke="#c8ff00" stroke-width="1.5" opacity="0.5"/>
      <path d="M40 18 L62 58 L18 58 Z" fill="none" stroke="#c8ff00" stroke-width="0.8" opacity="0.3"/>
      <line x1="40" y1="30" x2="40" y2="48" stroke="#c8ff00" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="40" cy="55" r="2.5" fill="#c8ff00"/>
      <circle cx="40" cy="37" r="28" fill="none" stroke="#c8ff00" stroke-width="0.5" opacity="0.15" stroke-dasharray="3 6"/>
    </svg>`,
    check: html`
    <svg class="feature-card__icon" viewBox="0 0 80 80" aria-hidden="true">
      <rect x="15" y="15" width="50" height="50" fill="none" stroke="#c8ff00" stroke-width="1" opacity="0.4" rx="2"/>
      <rect x="22" y="22" width="36" height="36" fill="none" stroke="#c8ff00" stroke-width="0.6" opacity="0.2"/>
      <polyline points="28,40 36,50 54,30" fill="none" stroke="#c8ff00" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="40" cy="40" r="32" fill="none" stroke="#c8ff00" stroke-width="0.5" opacity="0.15" stroke-dasharray="2 6"/>
    </svg>`,
};

@customElement("feature-card")
export class FeatureCard extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @property({ type: String }) num = "01";
    @property({ type: String }) title = "TITLE";
    @property({ type: String }) icon: Icon = "crosshair";
    @property({ type: String }) code = "";

    private _bodyHtml = "";
    private _tagsHtml = "";

    override connectedCallback() {
        // Capture slotted children BEFORE Lit renders (slots don't work in Light DOM)
        const bodyEl = this.querySelector('[slot="body"]');
        const tagsEl = this.querySelector('[slot="tags"]');
        if (bodyEl) {
            this._bodyHtml = bodyEl.innerHTML;
            bodyEl.remove();
        }
        if (tagsEl) {
            this._tagsHtml = tagsEl.innerHTML;
            tagsEl.remove();
        }
        super.connectedCallback();
    }

    override render() {
        return html`
      <div class="feature-card reveal panel">
        <div class="feature-card__header">
          <div class="feature-card__num">${this.num}</div>
          ${ICONS[this.icon] ?? ICONS.crosshair}
        </div>
        <h3 class="feature-card__title">${this.title}</h3>
        <p class="feature-card__body">
          ${unsafeHTML(this._bodyHtml)}
        </p>
        <div class="feature-card__detail">
          ${unsafeHTML(this._tagsHtml)}
        </div>
        ${this.code ? html`<div class="feature-card__code">${this.code}</div>` : ""}
      </div>
    `;
    }
}
