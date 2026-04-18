import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./marquee-ticker.css";

@customElement("marquee-ticker")
export class MarqueeTicker extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @property({ type: String }) variant: "default" | "alert" = "default";

    private readonly defaultItems = [
        "MEMPOOL SCANNING ACTIVE",
        "ZK PROOF VERIFICATION",
        "THREAT SIGNATURE DB: 2,847 PATTERNS",
        "NETWORK LATENCY: 12ms",
        "BLOCK #19284531",
        "POLICY ENGINE: ARMED",
        "RISC0 PROVER: ONLINE",
        "CONNECTED PROTOCOLS: 12",
        "LAST DEFENSE: 4m AGO",
        "CAPITAL PROTECTED: $21.09M",
    ];

    private readonly alertItems = [
        "/// ATTACK SURFACE EXPANDING ///",
        "$4.1B STOLEN IN 2023",
        "/// 13s AVERAGE EXPLOIT DURATION ///",
        "MULTISIG TOO SLOW",
        "/// AUDITS CHECK CODE NOT RUNTIME ///",
        "MONITORING CANNOT ACT",
        "/// NO TOOL PROVES PREVENTION ///",
        "ZERO ON-CHAIN ACCOUNTABILITY",
    ];

    override render() {
        const items = this.variant === "alert" ? this.alertItems : this.defaultItems;
        const colorClass = this.variant === "alert" ? "marquee--alert" : "";

        return html`
      <div class="marquee ${colorClass}" aria-hidden="true">
        <div class="marquee__track">
          ${[...items, ...items].map(
              (item) => html`
            <span class="marquee__item">
              <span class="marquee__dot"></span>
              ${item}
            </span>
          `,
          )}
        </div>
        <div class="marquee__track marquee__track--clone">
          ${[...items, ...items].map(
              (item) => html`
            <span class="marquee__item">
              <span class="marquee__dot"></span>
              ${item}
            </span>
          `,
          )}
        </div>
      </div>
    `;
    }
}
