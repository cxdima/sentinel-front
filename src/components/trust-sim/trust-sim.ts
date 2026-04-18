import { LitElement, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import { observeViewport, scrollProgress, subRange } from "../../utils/scroll";
import "./trust-sim.css";

type Phase = "idle" | "scanning" | "suspicion" | "proof" | "resolved";

const PHASE_META: Record<Phase, { label: string; color: string; index: number }> = {
    idle: { label: "STANDBY", color: "#9a9a9a", index: 0 },
    scanning: { label: "SCANNING MEMPOOL", color: "#00d9ff", index: 1 },
    suspicion: { label: "THREAT DETECTED", color: "#ff5266", index: 2 },
    proof: { label: "GENERATING PROOF", color: "#ffb84d", index: 3 },
    resolved: { label: "DEFENSE VERIFIED", color: "#c8ff00", index: 4 },
};

const PHASE_COPY: Record<Phase, { kicker: string; title: string; body: string }> = {
    idle: {
        kicker: "BLOCK #19284531",
        title: "A SUSPICIOUS TRANSACTION APPEARS.",
        body: "A flash loan is queued at the top of the next block. The pattern looks like every oracle exploit you have read about. Scroll to watch Sentinel respond inside the same block.",
    },
    scanning: {
        kicker: "PHASE 01 — DETECT",
        title: "EVERY MEMPOOL TX IS CHECKED IN PARALLEL.",
        body: "Sentinel reads pending transactions before they land on chain. It compares each one against thousands of attack signatures and runtime invariants — looking for the shape of an exploit, not just bad code.",
    },
    suspicion: {
        kicker: "PHASE 02 — IDENTIFY",
        title: "THE ATTACK CHAIN IS RECONSTRUCTED.",
        body: "A single transaction borrows 50,000 ETH, manipulates an oracle 340%, and queues a vault drain — all in one block. Five red flags fire at once. Pattern matches the Euler Finance exploit.",
    },
    proof: {
        kicker: "PHASE 03 — PROVE",
        title: "THE DEFENSE IS PROVEN BEFORE IT ACTS.",
        body: "Sentinel can only pause — never move funds. It generates a zero-knowledge proof showing the response is inside its policy and that the loss prevented was real. The proof is committed on-chain.",
    },
    resolved: {
        kicker: "PHASE 04 — RESOLVE",
        title: "$2.4M PROTECTED. RECEIPT ON CHAIN.",
        body: "The vault was paused two-tenths of a second after the attack appeared. The proof hash is verifiable by anyone. No human in the loop, no trust required.",
    },
};

@customElement("trust-sim")
export class TrustSim extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private progress = 0;
    @state() private phase: Phase = "idle";
    @state() private scanProgress = 0;
    @state() private scanLineCount = 0;
    @state() private threatCount = 0;
    @state() private proofCount = 0;
    @state() private hashLen = 0;
    @state() private savedNorm = 0;

    private ticking = false;
    private inView = false;
    private disposeObserver: (() => void) | null = null;
    private scanLineCache: { addr: string; level: "NORMAL" | "CHECKING" | "FLAGGED"; eth: string }[] = [];

    private get dotColor() {
        return PHASE_META[this.phase].color;
    }
    private get phaseLabel() {
        return PHASE_META[this.phase].label;
    }
    private get phaseIndex() {
        return PHASE_META[this.phase].index;
    }

    override connectedCallback() {
        super.connectedCallback();
        for (let i = 0; i < 14; i++) {
            this.scanLineCache.push({
                addr: "0x" + Math.random().toString(16).slice(2, 10),
                level: i < 5 ? "NORMAL" : i < 10 ? "CHECKING" : "FLAGGED",
                eth: (Math.random() * 100).toFixed(1),
            });
        }
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
            this.update_();
            this.ticking = false;
        });
    };

    private update_() {
        const section = this.querySelector<HTMLElement>(".trust-scrolly");
        if (!section) return;
        const rect = section.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;

        const p = scrollProgress(section);
        if (Math.abs(p - this.progress) < 0.001) return;
        this.progress = p;

        let phase: Phase = "idle";
        if (p < 0.06) phase = "idle";
        else if (p < 0.3) phase = "scanning";
        else if (p < 0.55) phase = "suspicion";
        else if (p < 0.82) phase = "proof";
        else phase = "resolved";

        if (phase !== this.phase) this.phase = phase;

        const scanSub = subRange(p, 0.06, 0.3);
        const newScan = Math.round(scanSub * 100);
        if (newScan !== this.scanProgress) this.scanProgress = newScan;
        const newLines = Math.min(this.scanLineCache.length, Math.round(scanSub * this.scanLineCache.length));
        if (newLines !== this.scanLineCount) this.scanLineCount = newLines;

        const threatSub = subRange(p, 0.3, 0.55);
        const newThreats = Math.min(5, Math.floor(threatSub * 6));
        if (newThreats !== this.threatCount) this.threatCount = newThreats;

        const proofSub = subRange(p, 0.55, 0.82);
        const newProofs = Math.min(3, Math.floor(proofSub * 3.5));
        if (newProofs !== this.proofCount) this.proofCount = newProofs;

        const hashSub = subRange(p, 0.68, 0.78);
        const newHashLen = Math.min(16, Math.floor(hashSub * 16));
        if (newHashLen !== this.hashLen) this.hashLen = newHashLen;

        const savedSub = subRange(p, 0.72, 0.88);
        const eased = 1 - Math.pow(1 - savedSub, 4);
        const newSaved = Math.round(eased * 100);
        if (newSaved !== this.savedNorm) this.savedNorm = newSaved;
    }

    private renderSvgViz() {
        const isScanning = this.phase === "scanning";
        const isThreat = this.phase === "suspicion";
        const isProof = this.phase === "proof";
        const isResolved = this.phase === "resolved";
        const animate = this.inView;

        const nodePositions = [
            { x: 60, y: 40, label: "POOL" },
            { x: 180, y: 30, label: "ORACL" },
            { x: 300, y: 50, label: "VAULT" },
            { x: 120, y: 110, label: "DEX" },
            { x: 240, y: 120, label: "LEND" },
        ];

        const edges = [
            [0, 1],
            [1, 2],
            [0, 3],
            [3, 4],
            [1, 4],
            [2, 4],
        ];

        return svg`
      <svg class="trust-viz" viewBox="0 0 360 160" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="ts-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1a1a" stroke-width="0.4"/>
          </pattern>
          <filter id="ts-glow-green">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="ts-glow-red">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="scan-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="transparent"/>
            <stop offset="50%" stop-color="#00d9ff"/>
            <stop offset="100%" stop-color="transparent"/>
          </linearGradient>
        </defs>
        <rect width="360" height="160" fill="url(#ts-grid)"/>

        ${edges.map(([a, b]) => {
            const n1 = nodePositions[a],
                n2 = nodePositions[b];
            const edgeColor = isResolved ? "#c8ff00" : isThreat ? "#ff5266" : isProof ? "#ffb84d" : "#3a3a3a";
            return svg`
            <line x1=${n1.x} y1=${n1.y} x2=${n2.x} y2=${n2.y}
              stroke=${edgeColor} stroke-width="0.7" stroke-dasharray="3 4"
              opacity=${isResolved ? "0.7" : isThreat ? "0.5" : isProof ? "0.5" : "0.5"}>
              ${
                  animate && (isThreat || isResolved || isProof)
                      ? svg`
                <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.5s" repeatCount="indefinite"/>
              `
                      : ""
              }
            </line>
          `;
        })}

        ${
            isThreat
                ? svg`
          <line x1="60" y1="40" x2="180" y2="30" stroke="#ff5266" stroke-width="2.2" opacity="0.9"
            filter="url(#ts-glow-red)">
            ${animate ? svg`<animate attributeName="opacity" values="0.5;1;0.5" dur="0.8s" repeatCount="indefinite"/>` : ""}
          </line>
          <line x1="180" y1="30" x2="300" y2="50" stroke="#ff5266" stroke-width="2.2" opacity="0.9"
            filter="url(#ts-glow-red)">
            ${animate ? svg`<animate attributeName="opacity" values="0.5;1;0.5" dur="0.8s" repeatCount="indefinite" begin="0.2s"/>` : ""}
          </line>
        `
                : ""
        }

        ${
            isScanning
                ? svg`
          <rect x="0" y=${(this.scanProgress / 100) * 150} width="360" height="3"
            fill="url(#scan-grad)" opacity="0.85"/>
        `
                : ""
        }

        ${nodePositions.map((n, i) => {
            const active = i < this.threatCount;
            const nodeColor = isResolved
                ? "#c8ff00"
                : isThreat && active
                  ? "#ff5266"
                  : isProof && active
                    ? "#ffb84d"
                    : isScanning
                      ? "#00d9ff"
                      : "#5a5a5a";
            return svg`
            <g>
              ${
                  animate && isThreat && active
                      ? svg`
                <circle cx=${n.x} cy=${n.y} r="14" fill="none" stroke="#ff5266" stroke-width="1">
                  <animate attributeName="r" from="14" to="28" dur="1s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" from="0.7" to="0" dur="1s" repeatCount="indefinite"/>
                </circle>
              `
                      : ""
              }
              ${
                  isResolved
                      ? svg`
                <circle cx=${n.x} cy=${n.y} r="14" fill="none" stroke="#c8ff00" stroke-width="0.8" opacity="0.4"/>
              `
                      : ""
              }
              <rect x=${n.x - 10} y=${n.y - 10} width="20" height="20"
                fill="#000" stroke=${nodeColor} stroke-width=${active || isResolved || isScanning ? "1.5" : "0.8"}/>
              <text x=${n.x} y=${n.y + 3} text-anchor="middle"
                fill=${nodeColor} font-size="5" font-family="'IBM Plex Mono',monospace"
                font-weight="600" letter-spacing="0.06em">${n.label}</text>
            </g>
          `;
        })}

        ${
            isResolved
                ? svg`
          <g transform="translate(180, 80)" filter="url(#ts-glow-green)">
            <path d="M0,-18 L14,-10 L14,6 L0,18 L-14,6 L-14,-10 Z"
              fill="none" stroke="#c8ff00" stroke-width="1.5"/>
            <path d="M-5,0 L-1,5 L7,-5" fill="none" stroke="#c8ff00" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        `
                : ""
        }
      </svg>
    `;
    }

    private renderBody() {
        // Render all phases always, use data-active for the current one.
        // This prevents the right panel from resizing as content changes.
        return html`
      <div class="trust-body-stack">
        <div class="trust-body-slot ${this.phase === "idle" ? "trust-body-slot--active" : ""}">${this.renderIdle()}</div>
        <div class="trust-body-slot ${this.phase === "scanning" ? "trust-body-slot--active" : ""}">${this.renderScanning()}</div>
        <div class="trust-body-slot ${this.phase === "suspicion" ? "trust-body-slot--active" : ""}">${this.renderThreat()}</div>
        <div class="trust-body-slot ${this.phase === "proof" ? "trust-body-slot--active" : ""}">${this.renderProving()}</div>
        <div class="trust-body-slot ${this.phase === "resolved" ? "trust-body-slot--active" : ""}">${this.renderResolved()}</div>
      </div>
    `;
    }

    private renderIdle() {
        return html`
      <div class="trust-idle">
        <div class="trust-idle__pulse" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <p class="trust-idle__line">Awaiting next pending transaction…</p>
        <p class="trust-idle__hint">↓ SCROLL TO RUN SIMULATION</p>
      </div>
    `;
    }

    private renderScanning() {
        const visible = this.scanLineCache.slice(0, this.scanLineCount);
        return html`
      <div class="trust-phase">
        <div class="trust-phase__bar">
          <div class="trust-phase__fill trust-phase__fill--cyan" style="width:${this.scanProgress}%"></div>
        </div>
        <div class="trust-phase__meta">
          <span>MEMPOOL DEPTH</span>
          <span class="trust-phase__count">${this.scanProgress}%</span>
        </div>
        <div class="trust-phase__grid">
          ${visible.map(
              (line) => html`
            <div class="trust-scan-line">
              <span class="trust-scan-line__addr">${line.addr}</span>
              <span class="trust-scan-line__label trust-scan-line__label--${line.level.toLowerCase()}">${line.level}</span>
              <span class="trust-scan-line__val ${line.level === "FLAGGED" ? "trust-scan-line__val--warn" : ""}">${line.eth} ETH</span>
            </div>
          `,
          )}
        </div>
      </div>
    `;
    }

    private renderThreat() {
        const threats = [
            { label: "Flash loan: 50,000 ETH borrowed in one transaction", severity: "HIGH" },
            {
                label: "Oracle price manipulated 340% within 1 block — impossible under normal conditions",
                severity: "CRITICAL",
            },
            { label: "Vault drain queued: $2.4M withdrawal against inflated collateral", severity: "CRITICAL" },
            { label: "Pattern matches Euler Finance exploit (March 2023, $197M stolen)", severity: "HIGH" },
            { label: "Zero-collateral withdrawal path found — this is the attack", severity: "CRITICAL" },
        ];
        return html`
      <div class="trust-phase">
        <div class="trust-threats">
          ${threats.map(
              (t, i) => html`
            <div class="trust-threat ${i < this.threatCount ? "trust-threat--visible" : ""}">
              <span class="trust-threat__severity trust-threat__severity--${t.severity.toLowerCase()}">${t.severity}</span>
              <span class="trust-threat__text">${t.label}</span>
            </div>
          `,
          )}
        </div>
      </div>
    `;
    }

    private renderProving() {
        const hashChars = "0123456789abcdef";
        let hashStr = "0x";
        for (let i = 0; i < this.hashLen; i++) {
            hashStr += hashChars[(i * 7 + 13) % 16];
        }
        if (this.hashLen > 0 && this.hashLen < 16) hashStr += "…";

        const steps = [
            { label: "Policy constraint check", detail: "Sentinel can only pause — never move funds. Verified." },
            { label: "Counterfactual simulation", detail: "Without intervention: LOSS = $2,400,000" },
            { label: "ZK proof generation", detail: hashStr || "Generating verifiable proof…" },
        ];
        return html`
      <div class="trust-phase">
        <div class="trust-proofs">
          ${steps.map(
              (s, i) => html`
            <div class="trust-proof ${i < this.proofCount ? "trust-proof--visible" : ""}">
              <div class="trust-proof__check">${i < this.proofCount ? "✓" : "○"}</div>
              <div class="trust-proof__content">
                <div class="trust-proof__label">${s.label}</div>
                <div class="trust-proof__detail ${i < this.proofCount ? "trust-proof__detail--done" : ""}">${i < this.proofCount ? s.detail : ""}</div>
              </div>
            </div>
          `,
          )}
        </div>
      </div>
    `;
    }

    private renderResolved() {
        const savedAmount = "$" + Math.round((this.savedNorm / 100) * 2400000).toLocaleString();
        return html`
      <div class="trust-resolved">
        <div class="trust-resolved__banner">
          <div class="trust-resolved__shield" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 32 32">
              <path d="M16,2 L28,8 L28,16 C28,23 22,28 16,30 C10,28 4,23 4,16 L4,8 Z"
                fill="none" stroke="#c8ff00" stroke-width="1.5"/>
              <path d="M10,16 L14,20 L22,12" fill="none" stroke="#c8ff00" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="trust-resolved__title">DEFENSE VERIFIED</div>
        </div>

        <div class="trust-resolved__grid">
          <div class="trust-resolved__row">
            <span class="trust-resolved__key">BLOCK</span>
            <span class="trust-resolved__val">#19284531 — PAUSE EXECUTED</span>
          </div>
          <div class="trust-resolved__row">
            <span class="trust-resolved__key">ATTACK</span>
            <span class="trust-resolved__val">FLASH LOAN ORACLE MANIPULATION</span>
          </div>
          <div class="trust-resolved__row">
            <span class="trust-resolved__key">POLICY</span>
            <span class="trust-resolved__val">0xabcd…1234 VERIFIED ON-CHAIN</span>
          </div>
          <div class="trust-resolved__row">
            <span class="trust-resolved__key">PROOF</span>
            <span class="trust-resolved__val">0x26755c87fd385eae… VERIFIED</span>
          </div>
          <div class="trust-resolved__row trust-resolved__row--accent">
            <span class="trust-resolved__key">SAVED</span>
            <span class="trust-resolved__val trust-resolved__val--big">${savedAmount}</span>
          </div>
        </div>
      </div>
    `;
    }

    override render() {
        const phases: Phase[] = ["idle", "scanning", "suspicion", "proof", "resolved"];
        const currentKicker = PHASE_COPY[this.phase].kicker;

        return html`
      <section class="trust-scrolly" id="sim" aria-labelledby="sim-heading">
        <div class="trust-scrolly__sticky">
          <span class="section-num" aria-hidden="true">05 / 08</span>

          <div class="trust-scrolly__grid">
            <!-- LEFT — narrative -->
            <div class="trust-narrative">
              <header class="trust-narrative__header">
                <span class="trust-narrative__eyebrow">// ${currentKicker}</span>
                <h2 id="sim-heading" class="trust-narrative__title">LIVE
                  <br/><span class="trust-narrative__title-accent">SIMULATION</span>
                </h2>
              </header>

              <div class="trust-narrative__body" data-phase=${this.phase}>
                ${phases.map((ph) => {
                    const copy = PHASE_COPY[ph];
                    const active = ph === this.phase;
                    return html`
                    <div class="trust-narrative__slot ${active ? "trust-narrative__slot--active" : ""}" aria-hidden=${active ? "false" : "true"}>
                      <div class="trust-narrative__phase-label">${copy.kicker}</div>
                      <h3 class="trust-narrative__heading">${copy.title}</h3>
                      <p class="trust-narrative__copy">${copy.body}</p>
                    </div>
                  `;
                })}
              </div>

              <div class="trust-narrative__steps" aria-hidden="true">
                ${phases.map(
                    (ph, i) => html`
                  <div class="trust-narrative__step ${i <= this.phaseIndex ? "trust-narrative__step--active" : ""} ${i === this.phaseIndex ? "trust-narrative__step--current" : ""}">
                    <span class="trust-narrative__step-num">0${i + 1}</span>
                    <span class="trust-narrative__step-label">${PHASE_META[ph].label}</span>
                  </div>
                `,
                )}
              </div>

              <div class="trust-narrative__progress" aria-hidden="true">
                <div class="trust-narrative__progress-fill" style="transform: scaleX(${this.progress})"></div>
              </div>
            </div>

            <!-- RIGHT — sim panel -->
            <div class="trust-stage">
              <article class="panel trust-sim" aria-label="Sentinel response panel">
                <div class="panel-header">
                  <span class="panel-label">Trust Interface — Flash Loan Oracle Attack</span>
                  <div class="trust-sim__phase-indicator">
                    <span class="trust-sim__phase-text">PHASE: ${this.phaseLabel}</span>
                    <div
                      class="trust-sim__phase-dot"
                      style="background: ${this.dotColor}; box-shadow: 0 0 12px ${this.dotColor}"
                    ></div>
                  </div>
                </div>

                <div class="trust-sim__viz ${this.phase !== "idle" ? "trust-sim__viz--active" : ""}">
                  ${this.renderSvgViz()}
                </div>

                <div class="trust-sim__body">
                  ${this.renderBody()}
                </div>
              </article>
            </div>
          </div>
        </div>

        <div class="trust-scrolly__spacer" aria-hidden="true"></div>
      </section>
    `;
    }
}
