import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { observeViewport, scrollProgress, subRange } from "../../utils/scroll";
import "./compare-table.css";

const ROWS = [
    { cap: "DETECTION SPEED", def: "Post-mine", forta: "Post-mine", msig: "Minutes", sentinel: "PRE-MINE (<200ms)" },
    { cap: "RESPONSE TIME", def: "10–30s", forta: "Alert only", msig: "5–60 min", sentinel: "SAME BLOCK (<3s)" },
    { cap: "PROOF OF PREVENTION", def: "None", forta: "None", msig: "None", sentinel: "ZK PROOF ON-CHAIN" },
    { cap: "LOSS QUANTIFICATION", def: "Manual estimate", forta: "None", msig: "None", sentinel: "EXACT DOLLAR DELTA" },
    { cap: "OPERATOR OVERRIDE", def: "Possible", forta: "N/A", msig: "Possible", sentinel: "MATH PREVENTS IT" },
    { cap: "NETWORK EFFECT", def: "None", forta: "Manual alerts", msig: "None", sentinel: "12 PROTOCOLS AUTO-IMMUNE" },
];

@customElement("compare-table")
export class CompareTable extends LitElement {
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
            const section = this.querySelector<HTMLElement>(".compare-scrolly");
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

    override render() {
        const headerIn = subRange(this.progress, 0, 0.12);
        const tableIn = subRange(this.progress, 0.08, 0.35);
        const calloutsIn = subRange(this.progress, 0.4, 0.7);

        return html`
      <section class="compare-scrolly" id="vs" aria-labelledby="vs-heading">
        <div class="compare-scrolly__sticky">
          <span class="section-num" aria-hidden="true">04 / 08</span>
          <div class="compare-scrolly__content">
            <header
              class="section__header"
              style="opacity: ${headerIn}; transform: translateY(${(1 - headerIn) * 20}px)"
            >
              <h2 id="vs-heading" class="section__label">VS EXISTING SOLUTIONS</h2>
              <span class="section__code">// WHY NOTHING ELSE DOES THIS</span>
            </header>

            <div
              class="compare-table-wrap"
              style="opacity: ${tableIn}; transform: translateY(${(1 - tableIn) * 40}px)"
            >
              <div class="compare-table-scroll">
                <table class="comp-table" role="table">
                  <thead>
                    <tr>
                      <th scope="col">CAPABILITY</th>
                      <th scope="col">OZ DEFENDER</th>
                      <th scope="col">FORTA</th>
                      <th scope="col">MULTISIG</th>
                      <th scope="col" class="comp-table__sentinel">SENTINEL</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ROWS.map((r, i) => {
                        const rowIn = subRange(this.progress, 0.12 + i * 0.04, 0.22 + i * 0.04);
                        return html`
                        <tr style="opacity: ${rowIn}; transform: translateY(${(1 - rowIn) * 16}px)">
                          <td>${r.cap}</td>
                          <td>${r.def}</td>
                          <td>${r.forta}</td>
                          <td>${r.msig}</td>
                          <td class="comp-table__highlight">${r.sentinel}</td>
                        </tr>
                      `;
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="compare-callouts" style="opacity: ${calloutsIn}">
              <div class="compare-callout" style="transform: translateY(${(1 - calloutsIn) * 40}px)">
                <div class="compare-callout__num">01</div>
                <div class="compare-callout__title">COUNTERFACTUAL PROOF</div>
                <div class="compare-callout__body">Every other system tells you an attack was stopped. SENTINEL proves it cryptographically, on-chain, with an exact dollar figure.</div>
              </div>
              <div class="compare-callout" style="transform: translateY(${(1 - calloutsIn) * 60}px)">
                <div class="compare-callout__num">02</div>
                <div class="compare-callout__title">POLICY-BOUNDED AI</div>
                <div class="compare-callout__body">The defense agent is architecturally incapable of acting outside its mandate. The math stops it, not a policy document.</div>
              </div>
              <div class="compare-callout" style="transform: translateY(${(1 - calloutsIn) * 80}px)">
                <div class="compare-callout__num">03</div>
                <div class="compare-callout__title">SUB-BLOCK RESPONSE</div>
                <div class="compare-callout__body">Every competitor detects post-mine. SENTINEL intercepts in the mempool. By the time others fire an alert, the exploit is already stopped.</div>
              </div>
            </div>
          </div>
        </div>
        <div class="compare-scrolly__spacer" aria-hidden="true"></div>
      </section>
    `;
    }
}
