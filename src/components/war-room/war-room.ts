import { LitElement, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./war-room.css";

type Tab = "overview" | "threats" | "proofs" | "network" | "timeline";

const THREAT_FEED = [
    {
        id: "0x7a3f…e91c",
        type: "FLASH LOAN ORACLE",
        severity: "CRITICAL",
        status: "NEUTRALIZED",
        delta: "$2.4M",
        time: "2s ago",
        color: "#c8ff00",
    },
    {
        id: "0x9c8e…12bb",
        type: "PRICE MANIPULATION",
        severity: "HIGH",
        status: "NEUTRALIZED",
        delta: "$5.1M",
        time: "14s ago",
        color: "#c8ff00",
    },
    {
        id: "0xd4f1…7c3e",
        type: "GOVERNANCE ATTACK",
        severity: "CRITICAL",
        status: "MONITORING",
        delta: "—",
        time: "28s ago",
        color: "#d47d27",
    },
    {
        id: "0x2b1d…f04a",
        type: "REENTRANCY",
        severity: "MEDIUM",
        status: "NEUTRALIZED",
        delta: "$0.89M",
        time: "1m ago",
        color: "#c8ff00",
    },
    {
        id: "0xf8a2…c391",
        type: "SANDWICH VECTOR",
        severity: "LOW",
        status: "DISMISSED",
        delta: "—",
        time: "3m ago",
        color: "#666",
    },
];

const PROTOCOLS = [
    { name: "Aave", status: "PROTECTED", threats: 12, uptime: "99.97%" },
    { name: "Compound", status: "PROTECTED", threats: 8, uptime: "99.99%" },
    { name: "Uniswap", status: "PROTECTED", threats: 15, uptime: "99.95%" },
    { name: "Curve", status: "PROTECTED", threats: 6, uptime: "99.98%" },
    { name: "Maker", status: "PROTECTED", threats: 4, uptime: "100%" },
    { name: "Lido", status: "PROTECTED", threats: 3, uptime: "99.99%" },
    { name: "Balancer", status: "MONITORING", threats: 1, uptime: "99.96%" },
    { name: "Synthetix", status: "PROTECTED", threats: 7, uptime: "99.98%" },
    { name: "dYdX", status: "PROTECTED", threats: 9, uptime: "99.97%" },
    { name: "Yearn", status: "PROTECTED", threats: 5, uptime: "99.99%" },
    { name: "Sushi", status: "PROTECTED", threats: 2, uptime: "100%" },
    { name: "1inch", status: "PROTECTED", threats: 3, uptime: "99.98%" },
];

@customElement("war-room")
export class WarRoom extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private tab: Tab = "overview";
    @state() private blockNum = 19284531;
    @state() private activeThreats = 1;
    @state() private mempoolTx = 342;

    private blockInterval = 0;
    private mempoolInterval = 0;

    override connectedCallback() {
        super.connectedCallback();
        this.blockInterval = window.setInterval(() => {
            this.blockNum++;
        }, 12000);
        this.mempoolInterval = window.setInterval(() => {
            this.mempoolTx = 300 + Math.floor(Math.random() * 100);
            this.activeThreats = Math.random() > 0.7 ? 2 : Math.random() > 0.5 ? 1 : 0;
        }, 3000);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this.blockInterval);
        clearInterval(this.mempoolInterval);
    }

    private setTab(t: Tab) {
        this.tab = t;
    }

    private renderTabs() {
        const tabs: { key: Tab; label: string }[] = [
            { key: "overview", label: "OVERVIEW" },
            { key: "threats", label: "THREAT FEED" },
            { key: "proofs", label: "PROOF LOG" },
            { key: "network", label: "NETWORK" },
            { key: "timeline", label: "TIMELINE" },
        ];
        return html`
      <nav class="wr-tabs" role="tablist">
        ${tabs.map(
            (t) => html`
          <button
            class="wr-tab ${this.tab === t.key ? "wr-tab--active" : ""}"
            role="tab"
            aria-selected=${this.tab === t.key}
            @click=${() => this.setTab(t.key)}
          >${t.label}</button>
        `,
        )}
      </nav>
    `;
    }

    private renderStatusBar() {
        return html`
      <div class="wr-status-bar">
        <div class="wr-status-item">
          <span class="status-dot"></span>
          <span class="wr-status-label">SYSTEM ACTIVE</span>
        </div>
        <div class="wr-status-item">
          <span class="wr-status-label">BLOCK</span>
          <span class="wr-status-value">#${this.blockNum}</span>
        </div>
        <div class="wr-status-item">
          <span class="wr-status-label">MEMPOOL</span>
          <span class="wr-status-value">${this.mempoolTx} TX</span>
        </div>
        <div class="wr-status-item">
          <span class="wr-status-label">ACTIVE THREATS</span>
          <span class="wr-status-value" style="color: ${this.activeThreats > 0 ? "#d47d27" : "#36c88b"}">${this.activeThreats}</span>
        </div>
        <div class="wr-status-item">
          <span class="wr-status-label">CHAIN</span>
          <span class="wr-status-value">ANVIL:8545</span>
        </div>
      </div>
    `;
    }

    private renderOverview() {
        return html`
      <div class="wr-overview">
        <div class="wr-grid-4">
          <div class="wr-metric-card">
            <div class="wr-metric-card__label">TOTAL PROTECTED</div>
            <div class="wr-metric-card__value">$21.09M</div>
            <div class="wr-metric-card__delta" style="color:#36c88b">+$2.4M last event</div>
          </div>
          <div class="wr-metric-card">
            <div class="wr-metric-card__label">THREATS STOPPED</div>
            <div class="wr-metric-card__value">47</div>
            <div class="wr-metric-card__delta" style="color:#36c88b">100% success rate</div>
          </div>
          <div class="wr-metric-card">
            <div class="wr-metric-card__label">AVG RESPONSE</div>
            <div class="wr-metric-card__value">340ms</div>
            <div class="wr-metric-card__delta" style="color:#c8ff00">sub-block speed</div>
          </div>
          <div class="wr-metric-card">
            <div class="wr-metric-card__label">PROOFS VERIFIED</div>
            <div class="wr-metric-card__value">47</div>
            <div class="wr-metric-card__delta" style="color:#c8ff00">all on-chain</div>
          </div>
        </div>

        <div class="wr-grid-2" style="margin-top:2px">
          <div class="panel">
            <div class="panel-header">
              <span class="panel-label">RECENT THREATS</span>
              <span class="panel-code">LAST 5 EVENTS</span>
            </div>
            <div class="wr-threat-list">
              ${THREAT_FEED.map(
                  (t) => html`
                <div class="wr-threat-row">
                  <div class="wr-threat-row__id">${t.id}</div>
                  <div class="wr-threat-row__type">${t.type}</div>
                  <div class="wr-threat-row__severity wr-threat-row__severity--${t.severity.toLowerCase()}">${t.severity}</div>
                  <div class="wr-threat-row__status" style="color:${t.color}">${t.status}</div>
                  <div class="wr-threat-row__delta">${t.delta}</div>
                  <div class="wr-threat-row__time">${t.time}</div>
                </div>
              `,
              )}
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <span class="panel-label">PROTOCOL STATUS</span>
              <span class="panel-code">${PROTOCOLS.length} SUBSCRIBED</span>
            </div>
            <div class="wr-protocol-list">
              ${PROTOCOLS.map(
                  (p) => html`
                <div class="wr-protocol-row">
                  <div class="wr-protocol-row__name">${p.name}</div>
                  <div class="wr-protocol-row__status" style="color: ${p.status === "PROTECTED" ? "#36c88b" : "#d47d27"}">${p.status}</div>
                  <div class="wr-protocol-row__threats">${p.threats} threats</div>
                  <div class="wr-protocol-row__uptime">${p.uptime}</div>
                </div>
              `,
              )}
            </div>
          </div>
        </div>

        <div class="panel" style="margin-top:2px">
          <div class="panel-header">
            <span class="panel-label">DEFENSE ACTIVITY — LAST 24H</span>
            <span class="panel-code">BLOCK-BY-BLOCK</span>
          </div>
          <div class="wr-chart-area">
            ${this.renderActivityChart()}
          </div>
        </div>
      </div>
    `;
    }

    private renderActivityChart() {
        const bars = Array.from({ length: 48 }, () => {
            const h = Math.random() * 60 + 5;
            const isAttack = Math.random() > 0.85;
            return { h, isAttack };
        });

        return svg`
      <svg class="wr-activity-svg" viewBox="0 0 960 100" preserveAspectRatio="none">
        ${bars.map(
            (b, i) => svg`
          <rect
            x=${i * 20} y=${100 - b.h}
            width="16" height=${b.h}
            fill=${b.isAttack ? "rgba(255,34,68,0.6)" : "rgba(200,255,0,0.15)"}
            rx="1"
          />
        `,
        )}
        <line x1="0" y1="50" x2="960" y2="50" stroke="#1a1a1a" stroke-width="0.5" stroke-dasharray="4 4"/>
      </svg>
    `;
    }

    private renderThreats() {
        return html`
      <div class="panel" style="height:100%">
        <div class="panel-header">
          <span class="panel-label">FULL THREAT LOG</span>
          <span class="panel-code">REAL-TIME FEED</span>
        </div>
        <div class="wr-threat-full">
          ${[...THREAT_FEED, ...THREAT_FEED, ...THREAT_FEED].map(
              (t, i) => html`
            <div class="wr-threat-detail">
              <div class="wr-threat-detail__header">
                <span class="wr-threat-detail__id">${t.id}</span>
                <span class="wr-threat-detail__badge" style="color:${t.color};border-color:${t.color}">${t.status}</span>
              </div>
              <div class="wr-threat-detail__type">${t.type}</div>
              <div class="wr-threat-detail__meta">
                <span>Severity: ${t.severity}</span>
                <span>Delta: ${t.delta}</span>
                <span>${t.time}</span>
              </div>
              ${
                  t.delta !== "—"
                      ? html`
                <div class="wr-threat-detail__proof">
                  <span style="color:#36c88b">PROOF VERIFIED</span> · Block #${19284531 - i * 12}
                </div>
              `
                      : ""
              }
            </div>
          `,
          )}
        </div>
      </div>
    `;
    }

    private renderProofs() {
        const proofs = THREAT_FEED.filter((t) => t.delta !== "—").flatMap((t, i) => [
            {
                event: t.id,
                circuit: "PolicyCompliance",
                status: "VERIFIED",
                time: `${(i + 1) * 3}s ago`,
                gas: `${180000 + i * 12000}`,
            },
            {
                event: t.id,
                circuit: "CounterfactualCorrectness",
                status: "VERIFIED",
                time: `${(i + 1) * 3 + 1}s ago`,
                gas: `${360000 + i * 8000}`,
            },
        ]);
        return html`
      <div class="panel" style="height:100%">
        <div class="panel-header">
          <span class="panel-label">ZK PROOF VERIFICATION LOG</span>
          <span class="panel-code">ON-CHAIN VERIFIED</span>
        </div>
        <div class="wr-proof-list">
          ${proofs.map(
              (p) => html`
            <div class="wr-proof-row">
              <div class="wr-proof-row__event">${p.event}</div>
              <div class="wr-proof-row__circuit">${p.circuit}</div>
              <div class="wr-proof-row__status" style="color:#36c88b">${p.status}</div>
              <div class="wr-proof-row__gas">${p.gas} gas</div>
              <div class="wr-proof-row__time">${p.time}</div>
            </div>
          `,
          )}
        </div>
      </div>
    `;
    }

    private renderNetwork() {
        return html`
      <div class="wr-grid-2">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-label">IMMUNITY NETWORK</span>
            <span class="panel-code">12 PROTOCOLS</span>
          </div>
          <div class="wr-network-grid">
            ${PROTOCOLS.map(
                (p) => html`
              <div class="wr-network-node ${p.status === "MONITORING" ? "wr-network-node--warn" : ""}">
                <div class="wr-network-node__name">${p.name}</div>
                <div class="wr-network-node__count">${p.threats} sigs</div>
              </div>
            `,
            )}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <span class="panel-label">PROPAGATION LOG</span>
            <span class="panel-code">THREAT SIGNATURES</span>
          </div>
          <div class="wr-prop-list">
            ${[
                "FLASH_LOAN_ORACLE_V1",
                "PRICE_MANIP_UNISWAP",
                "REENTRANCY_COMPOUND",
                "GOV_ATTACK_AAVE",
                "SANDWICH_DEX_V2",
            ].map(
                (sig, i) => html`
              <div class="wr-prop-row">
                <span class="wr-prop-row__sig">${sig}</span>
                <span class="wr-prop-row__count">${12 - i * 2} protocols</span>
                <span class="wr-prop-row__time">${(i + 1) * 2}s propagation</span>
              </div>
            `,
            )}
          </div>
        </div>
      </div>
    `;
    }

    private renderTimeline() {
        const blocks = Array.from({ length: 20 }, (_, i) => {
            const num = this.blockNum - 19 + i;
            const events: string[] = [];
            if (Math.random() > 0.7) events.push("detection");
            if (Math.random() > 0.8) events.push("defense");
            if (Math.random() > 0.85) events.push("proof");
            return { num, events };
        });

        return html`
      <div class="panel" style="height:100%">
        <div class="panel-header">
          <span class="panel-label">BLOCK-BY-BLOCK TIMELINE</span>
          <span class="panel-code">WITH SENTINEL ACTIVE</span>
        </div>
        <div class="wr-timeline-blocks">
          ${blocks.map(
              (b) => html`
            <div class="wr-block ${b.events.length > 0 ? "wr-block--active" : ""}">
              <div class="wr-block__num">#${b.num}</div>
              <div class="wr-block__events">
                ${b.events.map(
                    (e) => html`
                  <span class="wr-block__event wr-block__event--${e}">${e.slice(0, 3).toUpperCase()}</span>
                `,
                )}
              </div>
            </div>
          `,
          )}
        </div>
      </div>
    `;
    }

    override render() {
        return html`
      <div class="war-room">
        <div class="wr-header">
          <div class="wr-header__left">
            <a href="#/" class="wr-header__back" @click=${(e: Event) => {
                e.preventDefault();
                window.location.hash = "#/";
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </a>
            <div class="wr-header__title">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <line x1="9" y1="0" x2="9" y2="18" stroke="#c8ff00" stroke-width="1" opacity="0.7"/>
                <line x1="0" y1="9" x2="18" y2="9" stroke="#c8ff00" stroke-width="1" opacity="0.7"/>
                <circle cx="9" cy="9" r="5" fill="none" stroke="#c8ff00" stroke-width="1" opacity="0.5"/>
                <circle cx="9" cy="9" r="2" fill="#c8ff00" opacity="0.9"/>
              </svg>
              <span class="wr-header__wordmark">SENTINEL</span>
              <span class="wr-header__badge">WAR ROOM</span>
              <a
                href="#/demo"
                class="wr-header__demo-link"
                @click=${(e: Event) => {
                    e.preventDefault();
                    window.location.hash = "#/demo";
                }}
                title="Launch the interactive live simulation"
              >▶ LIVE SIMULATION</a>
            </div>
          </div>
          ${this.renderStatusBar()}
        </div>

        ${this.renderTabs()}

        <div class="wr-content">
          ${this.tab === "overview" ? this.renderOverview() : ""}
          ${this.tab === "threats" ? this.renderThreats() : ""}
          ${this.tab === "proofs" ? this.renderProofs() : ""}
          ${this.tab === "network" ? this.renderNetwork() : ""}
          ${this.tab === "timeline" ? this.renderTimeline() : ""}
        </div>
      </div>
    `;
    }
}
