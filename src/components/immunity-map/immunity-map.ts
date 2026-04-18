import { LitElement, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import { observeViewport, scrollProgress, subRange } from "../../utils/scroll";
import "./immunity-map.css";

type Phase = "idle" | "incident" | "broadcast" | "immunity";

interface Protocol {
    short: string;
    name: string;
    tvl: string;
    x: number;
    y: number;
}

const CX = 210;
const CY = 170;
const R = 120;

const PROTOCOLS: Protocol[] = [
    { short: "AAVE", name: "Aave", tvl: "$8.2B", x: 0, y: 0 },
    { short: "UNI", name: "Uniswap", tvl: "$5.6B", x: 0, y: 0 },
    { short: "MKR", name: "Maker", tvl: "$9.1B", x: 0, y: 0 },
    { short: "LIDO", name: "Lido", tvl: "$22B", x: 0, y: 0 },
    { short: "CRV", name: "Curve", tvl: "$2.1B", x: 0, y: 0 },
    { short: "COMP", name: "Compound", tvl: "$2.4B", x: 0, y: 0 },
];
// pre-compute positions for stable render
PROTOCOLS.forEach((p, i) => {
    const a = (i / PROTOCOLS.length) * Math.PI * 2 - Math.PI / 2;
    p.x = CX + R * Math.cos(a);
    p.y = CY + R * Math.sin(a);
});

const PHASE_COPY: Record<Phase, { step: string; kicker: string; title: string; body: string }> = {
    idle: {
        step: "00",
        kicker: "STATE / STANDBY",
        title: "EVERY PROTOCOL STANDS ALONE.",
        body: "Today, when one DeFi protocol is attacked, the other eleven are blind to it. The same exploit gets replayed for weeks until each one notices independently. Scroll to watch how Sentinel breaks that loop.",
    },
    incident: {
        step: "01",
        kicker: "PHASE 01 / INCIDENT",
        title: "ONE PROTOCOL IS ATTACKED.",
        body: "A flash-loan oracle exploit lands on Aave. Sentinel pauses the vault inside the same block, stopping $2.4M from leaving. But the attack pattern still exists, and every other protocol is still vulnerable to the same trick.",
    },
    broadcast: {
        step: "02",
        kicker: "PHASE 02 / BROADCAST",
        title: "THE SIGNATURE PROPAGATES.",
        body: "Sentinel extracts the attack signature — a cryptographic fingerprint of the exploit — and publishes it to the ThreatRegistry. The signature travels across the network in a single block, reaching every connected protocol.",
    },
    immunity: {
        step: "03",
        kicker: "PHASE 03 / GLOBAL IMMUNITY",
        title: "EVERY PROTOCOL IS IMMUNE.",
        body: "Within ~2 seconds, all twelve protocols in the mesh reject the same attack. What used to be a month-long cascade of copycat exploits is now neutralised by the first detection. One attack immunises everyone.",
    },
};

@customElement("immunity-map")
export class ImmunityMap extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private progress = 0;
    @state() private phase: Phase = "idle";
    @state() private attackApproach = 0; // 0→1 attack arrow travelling in
    @state() private broadcastRadius = 0; // 0→1 broadcast wave radius factor
    @state() private immunizedCount = 0;
    @state() private elapsedMs = 0;
    @state() private inView = false;

    private ticking = false;
    private disposeObserver: (() => void) | null = null;

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

    private readonly onScroll = () => {
        if (!this.inView || this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            this.updateScroll();
            this.ticking = false;
        });
    };

    private updateScroll() {
        const section = this.querySelector<HTMLElement>(".imm-scrolly");
        if (!section) return;

        const p = scrollProgress(section);
        if (Math.abs(p - this.progress) < 0.001) return;
        this.progress = p;

        let nextPhase: Phase = "idle";
        if (p < 0.1) nextPhase = "idle";
        else if (p < 0.38) nextPhase = "incident";
        else if (p < 0.65) nextPhase = "broadcast";
        else nextPhase = "immunity";
        if (nextPhase !== this.phase) this.phase = nextPhase;

        // Attack arrow approach (flies in during idle → incident)
        const approachSub = subRange(p, 0.05, 0.18);
        this.attackApproach = approachSub;

        // Broadcast wave expanding outwards
        const bcastSub = subRange(p, 0.4, 0.62);
        this.broadcastRadius = bcastSub;

        // Immunized count ticks up during broadcast/immunity
        const immSub = subRange(p, 0.48, 0.78);
        const eased = 1 - Math.pow(1 - immSub, 3);
        const count = Math.floor(eased * (PROTOCOLS.length - 1));
        if (count !== this.immunizedCount) this.immunizedCount = count;

        // Running timer (ms) for dramatic effect
        const timerSub = subRange(p, 0.38, 0.78);
        this.elapsedMs = Math.round(timerSub * 2100);
    }

    private renderAttackMarker() {
        if (this.phase === "idle" && this.attackApproach === 0) return "";
        // Attack starts off-screen top-left, flies toward AAVE (index 0 — top)
        const target = PROTOCOLS[0];
        const start = { x: -40, y: -40 };
        const t = this.attackApproach;
        const x = start.x + (target.x - start.x) * t;
        const y = start.y + (target.y - start.y) * t;

        const isLanded =
            t >= 1 && (this.phase === "incident" || this.phase === "broadcast" || this.phase === "immunity");

        return svg`
      <g class="imm-attack-marker">
        <line x1=${start.x} y1=${start.y} x2=${x} y2=${y}
          stroke="#ff2244" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>
        <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">
          <circle r="8" fill="rgba(255,34,68,0.15)" stroke="#ff2244" stroke-width="1"/>
          <text text-anchor="middle" y="3" fill="#ff2244"
            font-size="9" font-family="'IBM Plex Mono',monospace" font-weight="700">!</text>
        </g>
        ${
            isLanded && this.inView
                ? svg`
          <g transform="translate(${target.x.toFixed(1)}, ${target.y.toFixed(1)})">
            <circle r="22" fill="none" stroke="#ff2244" stroke-width="1.2">
              <animate attributeName="r" from="16" to="34" dur="1.2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" from="0.9" to="0" dur="1.2s" repeatCount="indefinite"/>
            </circle>
          </g>
        `
                : ""
        }
      </g>
    `;
    }

    private renderBroadcastWave() {
        if (this.broadcastRadius === 0) return "";
        const origin = PROTOCOLS[0];
        const maxR = R + 60;
        const r = 10 + this.broadcastRadius * maxR;
        const opacity = Math.max(0, 1 - this.broadcastRadius * 0.9);

        return svg`
      <g class="imm-broadcast-wave" opacity=${opacity}>
        <circle cx=${origin.x.toFixed(1)} cy=${origin.y.toFixed(1)} r=${r.toFixed(1)}
          fill="none" stroke="#c8ff00" stroke-width="1.2"/>
        <circle cx=${origin.x.toFixed(1)} cy=${origin.y.toFixed(1)} r=${(r * 0.7).toFixed(1)}
          fill="none" stroke="#c8ff00" stroke-width="0.6" opacity="0.6"/>
      </g>
    `;
    }

    private renderSignaturePackets() {
        // During broadcast phase, packets flow from origin → hub → each other protocol
        if (this.phase !== "broadcast" && this.phase !== "immunity") return "";
        const origin = PROTOCOLS[0];
        const animate = this.inView;

        return svg`
      <g class="imm-packets">
        <line x1=${origin.x.toFixed(1)} y1=${origin.y.toFixed(1)} x2=${CX} y2=${CY}
          stroke="#c8ff00" stroke-width="0.8" opacity="0.7"/>
        ${
            animate
                ? svg`
          <circle r="2" fill="#c8ff00">
            <animateMotion dur="0.9s" repeatCount="indefinite"
              path=${"M" + origin.x.toFixed(1) + "," + origin.y.toFixed(1) + " L" + CX + "," + CY}/>
            <animate attributeName="opacity" values="0;1;0" dur="0.9s" repeatCount="indefinite"/>
          </circle>
        `
                : ""
        }
        ${PROTOCOLS.slice(1).map(
            (p, i) => svg`
          <line x1=${CX} y1=${CY} x2=${p.x.toFixed(1)} y2=${p.y.toFixed(1)}
            stroke="#c8ff00" stroke-width="0.5" opacity=${i < this.immunizedCount ? "0.55" : "0.15"}/>
          ${
              animate && i < this.immunizedCount
                  ? svg`
            <circle r="1.8" fill="#c8ff00">
              <animateMotion dur="0.7s" repeatCount="indefinite" begin=${(i * 0.08).toFixed(2) + "s"}
                path=${"M" + CX + "," + CY + " L" + p.x.toFixed(1) + "," + p.y.toFixed(1)}/>
            </circle>
          `
                  : ""
          }
        `,
        )}
      </g>
    `;
    }

    private renderNode(proto: Protocol, i: number) {
        const isOrigin = i === 0;
        const isImmune =
            !isOrigin && i - 1 < this.immunizedCount && (this.phase === "broadcast" || this.phase === "immunity");
        const isAttacked =
            isOrigin && (this.phase === "incident" || this.phase === "broadcast" || this.phase === "immunity");

        const stroke = isAttacked ? "#ff2244" : isImmune ? "#c8ff00" : "#2a2a2a";
        const fill = isAttacked ? "rgba(255,34,68,0.08)" : isImmune ? "rgba(200,255,0,0.06)" : "#000";
        const textColor = isAttacked ? "#ff5266" : isImmune ? "#c8ff00" : "#b8b8b8";

        return svg`
      <g class="imm-node">
        ${
            isImmune
                ? svg`
          <path d=${`M${proto.x - 14},${proto.y - 12} L${proto.x},${proto.y - 18} L${proto.x + 14},${proto.y - 12} L${proto.x + 14},${proto.y + 4} Q${proto.x + 14},${proto.y + 14} ${proto.x},${proto.y + 18} Q${proto.x - 14},${proto.y + 14} ${proto.x - 14},${proto.y + 4} Z`}
            fill="none" stroke="#c8ff00" stroke-width="0.8" opacity="0.55"/>
        `
                : ""
        }
        <rect
          x=${(proto.x - 18).toFixed(1)} y=${(proto.y - 12).toFixed(1)}
          width="36" height="24"
          fill=${fill} stroke=${stroke} stroke-width=${isAttacked || isImmune ? "1.2" : "0.6"}
          rx="1.5"
        />
        <text x=${proto.x.toFixed(1)} y=${(proto.y - 1).toFixed(1)}
          text-anchor="middle"
          fill=${textColor} font-size="6.5" font-family="'IBM Plex Mono',monospace"
          font-weight="700" letter-spacing="0.05em">${proto.short}</text>
        <text x=${proto.x.toFixed(1)} y=${(proto.y + 7).toFixed(1)}
          text-anchor="middle"
          fill=${isAttacked ? "#ff5266" : isImmune ? "#c8ff00" : "#666"}
          font-size="4.5" font-family="'IBM Plex Mono',monospace">${proto.tvl}</text>
        ${
            isImmune
                ? svg`
          <g transform="translate(${(proto.x + 14).toFixed(1)}, ${(proto.y - 14).toFixed(1)})">
            <circle r="5" fill="#0a0a0a" stroke="#c8ff00" stroke-width="0.8"/>
            <path d="M-2.5,0 L-0.5,2 L2.5,-2" fill="none" stroke="#c8ff00" stroke-width="1" stroke-linecap="round"/>
          </g>
        `
                : ""
        }
        ${
            isAttacked
                ? svg`
          <g transform="translate(${(proto.x + 14).toFixed(1)}, ${(proto.y - 14).toFixed(1)})">
            <circle r="5" fill="#0a0a0a" stroke="#ff2244" stroke-width="0.8"/>
            <text text-anchor="middle" y="2" fill="#ff2244"
              font-size="6" font-family="'IBM Plex Mono',monospace" font-weight="700">!</text>
          </g>
        `
                : ""
        }
      </g>
    `;
    }

    private renderSvg() {
        const hubActive = this.phase !== "idle";

        return svg`
      <svg class="imm-svg" viewBox="0 0 420 340" role="img" aria-label="Immunity network attack propagation">
        <defs>
          <radialGradient id="hub-glow3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#c8ff00" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="#c8ff00" stop-opacity="0"/>
          </radialGradient>
          <pattern id="imm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#151515" stroke-width="0.3"/>
          </pattern>
        </defs>

        <rect width="420" height="340" fill="url(#imm-grid)"/>

        <!-- Hub glow aura -->
        <circle cx=${CX} cy=${CY} r="95" fill="url(#hub-glow3)"/>

        <!-- Spokes (baseline connections) -->
        ${PROTOCOLS.map(
            (p) => svg`
          <line x1=${p.x.toFixed(1)} y1=${p.y.toFixed(1)} x2=${CX} y2=${CY}
            stroke="#1a1a1a" stroke-width="0.5" stroke-dasharray="2 4"/>
        `,
        )}

        <!-- Broadcast wave -->
        ${this.renderBroadcastWave()}

        <!-- Signature packets flowing out -->
        ${this.renderSignaturePackets()}

        <!-- Attack marker arriving -->
        ${this.renderAttackMarker()}

        <!-- Central hub -->
        <circle cx=${CX} cy=${CY} r="26"
          fill=${hubActive ? "rgba(200,255,0,0.08)" : "rgba(200,255,0,0.03)"}
          stroke="#c8ff00" stroke-width=${hubActive ? "1.4" : "0.8"}/>
        <text x=${CX} y=${CY - 3} text-anchor="middle"
          fill="#c8ff00" font-size="8" font-family="'IBM Plex Mono',monospace"
          font-weight="700" letter-spacing="0.12em">SNTL</text>
        <text x=${CX} y=${CY + 8} text-anchor="middle"
          fill="#8a8a8a" font-size="5" font-family="'IBM Plex Mono',monospace"
          letter-spacing="0.12em">REGISTRY</text>

        <!-- Protocol nodes -->
        ${PROTOCOLS.map((p, i) => this.renderNode(p, i))}
      </svg>
    `;
    }

    override render() {
        const copy = PHASE_COPY[this.phase];
        const phases: Phase[] = ["idle", "incident", "broadcast", "immunity"];
        const phaseIndex = phases.indexOf(this.phase);

        const elapsed = (this.elapsedMs / 1000).toFixed(2);
        const totalProtocols = PROTOCOLS.length;
        const immunized = this.phase === "idle" ? 0 : this.immunizedCount;

        // hub status text
        const hubStatus =
            this.phase === "idle"
                ? "STANDBY"
                : this.phase === "incident"
                  ? "THREAT DETECTED"
                  : this.phase === "broadcast"
                    ? "SIGNATURE PROPAGATING"
                    : "ALL NODES IMMUNE";

        return html`
      <section class="imm-scrolly" id="network" aria-labelledby="net-heading">
        <div class="imm-scrolly__sticky">
          <span class="section-num" aria-hidden="true">06 / 08</span>

          <div class="imm-grid">
            <!-- LEFT — narrative -->
            <div class="imm-narrative">
              <header class="imm-narrative__header">
                <span class="imm-narrative__eyebrow">// ${copy.kicker}</span>
                <h2 id="net-heading" class="imm-narrative__title">IMMUNITY
                  <br/><span class="imm-narrative__title-accent">NETWORK</span>
                </h2>
                <div class="imm-narrative__intro">One attack detected. Every protocol learns from it.</div>
              </header>

              <div class="imm-narrative__body">
                ${phases.map((ph) => {
                    const c = PHASE_COPY[ph];
                    const active = ph === this.phase;
                    return html`
                    <div class="imm-narrative__slot ${active ? "imm-narrative__slot--active" : ""}" aria-hidden=${active ? "false" : "true"}>
                      <div class="imm-narrative__phase-label">${c.kicker}</div>
                      <h3 class="imm-narrative__heading">${c.title}</h3>
                      <p class="imm-narrative__copy">${c.body}</p>
                    </div>
                  `;
                })}
              </div>

              <div class="imm-narrative__steps" aria-hidden="true">
                ${phases.slice(1).map((ph, i) => {
                    const stepIdx = i + 1;
                    const isDone = stepIdx < phaseIndex;
                    const isCurrent = stepIdx === phaseIndex;
                    return html`
                    <div class="imm-step-row ${isDone ? "imm-step-row--done" : ""} ${isCurrent ? "imm-step-row--current" : ""}">
                      <span class="imm-step-row__num">${PHASE_COPY[ph].step}</span>
                      <span class="imm-step-row__label">${PHASE_COPY[ph].kicker.split("/")[1]?.trim() ?? PHASE_COPY[ph].kicker}</span>
                      <span class="imm-step-row__mark">${isDone ? "✓" : isCurrent ? "●" : "○"}</span>
                    </div>
                  `;
                })}
              </div>
            </div>

            <!-- RIGHT — stage -->
            <div class="imm-stage">
              <article class="panel imm-viz" aria-label="Immunity network visualization">
                <div class="panel-header imm-viz__header">
                  <span class="panel-label">NETWORK MESH — LIVE</span>
                  <span class="panel-code imm-viz__status" style="color:${this.phase === "idle" ? "#9a9a9a" : this.phase === "incident" ? "#ff5266" : "#c8ff00"}">
                    <span class="imm-viz__status-dot" style="background:${this.phase === "idle" ? "#9a9a9a" : this.phase === "incident" ? "#ff5266" : "#c8ff00"}"></span>
                    ${hubStatus}
                  </span>
                </div>

                <div class="imm-viz__stage">
                  ${this.renderSvg()}
                </div>

                <!-- Live telemetry strip -->
                <div class="imm-telemetry">
                  <div class="imm-telemetry__cell">
                    <div class="imm-telemetry__key">IMMUNIZED</div>
                    <div class="imm-telemetry__val imm-telemetry__val--accent">
                      ${immunized} <span class="imm-telemetry__tot">/ ${totalProtocols - 1}</span>
                    </div>
                  </div>
                  <div class="imm-telemetry__cell">
                    <div class="imm-telemetry__key">PROPAGATION</div>
                    <div class="imm-telemetry__val">${elapsed}s</div>
                  </div>
                  <div class="imm-telemetry__cell">
                    <div class="imm-telemetry__key">SIGNATURE</div>
                    <div class="imm-telemetry__val imm-telemetry__val--hash">
                      ${this.phase === "idle" ? "—" : "0xa2f4…e91b"}
                    </div>
                  </div>
                  <div class="imm-telemetry__cell">
                    <div class="imm-telemetry__key">BLOCK</div>
                    <div class="imm-telemetry__val">#19284531</div>
                  </div>
                </div>
              </article>

              <!-- Bottom metric row -->
              <div class="imm-summary">
                <div class="imm-summary__cell">
                  <div class="imm-summary__val">47</div>
                  <div class="imm-summary__key">ATTACKS SHARED</div>
                </div>
                <div class="imm-summary__cell">
                  <div class="imm-summary__val">12</div>
                  <div class="imm-summary__key">PROTOCOLS IN MESH</div>
                </div>
                <div class="imm-summary__cell">
                  <div class="imm-summary__val">~2.1<span class="imm-summary__unit">s</span></div>
                  <div class="imm-summary__key">AVG PROPAGATION</div>
                </div>
                <div class="imm-summary__cell">
                  <div class="imm-summary__val">$127<span class="imm-summary__unit">M</span></div>
                  <div class="imm-summary__key">SAVED LAST 30D</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="imm-scrolly__spacer" aria-hidden="true"></div>
      </section>
    `;
    }
}
