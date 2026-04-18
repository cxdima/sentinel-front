import { LitElement, html, nothing, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { EventEnvelope } from "../../lib/ws";
import "./network-map.css";

type ScenarioHint =
    | "flash-loan"
    | "preemptive"
    | "inject-instruction"
    | "blitz"
    | "recon"
    | "stealth"
    | "sandwich"
    | "pingflood"
    | "dust"
    | "reentrant"
    | "routine"
    | null;

/** Narrative-consistent victim per scenario. Keeps the story repeatable demo-to-demo. */
const SCENARIO_VICTIM: Record<Exclude<ScenarioHint, null>, number> = {
    "flash-loan": 0, // AAVE
    preemptive: 7, // SNX (Synthetix)
    "inject-instruction": 5, // COMP
    blitz: 0, // AAVE  — flash-loan oracle manip
    recon: 0, // AAVE  — same victim, patient approach
    stealth: 1, // UNI   — direct exploit
    sandwich: 4, // CRV   — MEV around a pair
    pingflood: 2, // MKR   — oracle ping flood
    dust: 10, // SUSHI — dust-storm evasion
    reentrant: 9, // YFI   — reentrancy drain
    routine: 6, // BAL   — benign baseline
};

/**
 * Live network-map visualization for the War Demo Room.
 *
 * Renders a 12-protocol mesh around a central SENTINEL hub and reacts to the
 * event firehose:
 *   PENDING_TX            → attacker vector aimed at the victim node
 *   THREAT_CONFIRMED      → victim node turns red, pulses
 *   DEFENSE_SUBMITTED     → hub emits a defense packet
 *   DEFENSE_MINED         → victim node gains a green shield
 *   PROVER_FINISHED       → hub glows chartreuse (zk proof complete)
 *   LEDGER_RECORDED       → hub gets a ledger-committed badge
 *   PREEMPTIVE_SIGNATURE  → hub emits a broadcast wave
 *   FEDERATION_SYNC       → a peer node turns immune
 *   PREEMPTIVE_EXECUTED   → all peers turn immune
 *
 * Parent passes `feed` (newest first) + `activeEventId`. The component
 * derives its own transient animation state from the event kinds it sees.
 */

interface Protocol {
    short: string;
    name: string;
    tvl: string;
    x: number;
    y: number;
}

const VIEW_W = 960;
const VIEW_H = 440;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const R = 160;

const PROTOS: Protocol[] = [
    { short: "AAVE", name: "Aave", tvl: "$8.2B", x: 0, y: 0 },
    { short: "UNI", name: "Uniswap", tvl: "$5.6B", x: 0, y: 0 },
    { short: "MKR", name: "Maker", tvl: "$9.1B", x: 0, y: 0 },
    { short: "LIDO", name: "Lido", tvl: "$22B", x: 0, y: 0 },
    { short: "CRV", name: "Curve", tvl: "$2.1B", x: 0, y: 0 },
    { short: "COMP", name: "Compound", tvl: "$2.4B", x: 0, y: 0 },
    { short: "BAL", name: "Balancer", tvl: "$900M", x: 0, y: 0 },
    { short: "SNX", name: "Synthetix", tvl: "$620M", x: 0, y: 0 },
    { short: "DYDX", name: "dYdX", tvl: "$380M", x: 0, y: 0 },
    { short: "YFI", name: "Yearn", tvl: "$320M", x: 0, y: 0 },
    { short: "SUSHI", name: "Sushi", tvl: "$280M", x: 0, y: 0 },
    { short: "1INCH", name: "1inch", tvl: "$210M", x: 0, y: 0 },
];
PROTOS.forEach((p, i) => {
    const a = (i / PROTOS.length) * Math.PI * 2 - Math.PI / 2;
    p.x = CX + R * Math.cos(a);
    p.y = CY + R * Math.sin(a);
});

type NodeState = "idle" | "attacked" | "shielded" | "immune";

interface NodeRuntime {
    state: NodeState;
    attackedAt: number | null;
    shieldedAt: number | null;
    immuneAt: number | null;
}

interface HubRuntime {
    proofFlashUntil: number; // epoch ms
    ledgerFlashUntil: number;
    broadcastUntil: number; // broadcast wave animation deadline
    scanUntil: number; // cyan scan-line sweep deadline
    status: string;
    statusColor: string;
}

/** Cheap 32-bit hash so we can map an eventId (or any string) to a node index deterministically. */
function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

@customElement("network-map")
export class NetworkMap extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @property({ attribute: false }) feed: EventEnvelope[] = [];
    @property({ attribute: false }) activeEventId: string | null = null;
    @property({ type: String }) mode: "live" | "simulation" | "probing" = "simulation";
    @property({ attribute: false }) scenarioHint: ScenarioHint = null;
    @property({ type: Number }) lastLatencyMs: number | null = null;
    @property({ type: Number }) totalPreventedEth: number = 0;
    /** Rolling mempool depth (last 5s). Parent computes it. */
    @property({ type: Number }) mempoolDepth: number = 0;
    /** Optional live TVL map keyed by node SHORT code. Overrides compiled defaults when populated. */
    @property({ attribute: false }) liveTvls: Record<string, string> = {};

    @state() private banner: {
        kind: "threat" | "defense" | "proof" | "ledger";
        title: string;
        sub: string;
        until: number;
    } | null = null;
    @state() private ambientPackets: Array<{ id: string; node: number; startedAt: number; dur: number }> = [];

    @state() private nodes: NodeRuntime[] = PROTOS.map(() => ({
        state: "idle",
        attackedAt: null,
        shieldedAt: null,
        immuneAt: null,
    }));
    @state() private hub: HubRuntime = {
        proofFlashUntil: 0,
        ledgerFlashUntil: 0,
        broadcastUntil: 0,
        scanUntil: 0,
        status: "STANDBY",
        statusColor: "#9a9a9a",
    };
    @state() private victimIdx = 0;
    @state() private attackFly = 0; // 0..1 — visible only during PENDING_TX observation of active run
    @state() private defensePackets: Array<{ id: string; to: number; startedAt: number; dur: number }> = [];
    @state() private now = Date.now();

    private seenMsgIds = new Set<string>();
    private animTimer = 0;
    private ambientTimer = 0;
    private attackFlyStart = 0;

    override connectedCallback() {
        super.connectedCallback();
        this.animTimer = window.setInterval(() => {
            this.now = Date.now();
            // Advance attack-fly if in progress
            if (this.attackFlyStart > 0) {
                const t = (this.now - this.attackFlyStart) / 900;
                this.attackFly = Math.min(1, t);
                if (this.attackFly >= 1) this.attackFlyStart = 0;
            }
            // Decay completed defense packets
            if (this.defensePackets.length > 0) {
                const cutoff = this.now - 150;
                this.defensePackets = this.defensePackets.filter((p) => p.startedAt + p.dur > cutoff);
            }
            // Decay completed ambient packets
            if (this.ambientPackets.length > 0) {
                const cutoff = this.now - 150;
                this.ambientPackets = this.ambientPackets.filter((p) => p.startedAt + p.dur > cutoff);
            }
            // Auto-dismiss banner
            if (this.banner && this.now > this.banner.until) {
                this.banner = null;
            }
        }, 66);

        // Idle ambient "peer heartbeat" packets — one peer glows ~every 900ms when no scenario is running
        this.ambientTimer = window.setInterval(() => {
            if (this.activeEventId) return; // don't distract during an active run
            const idx = Math.floor(Math.random() * PROTOS.length);
            this.ambientPackets = [
                ...this.ambientPackets,
                { id: `amb-${this.now}-${idx}`, node: idx, startedAt: Date.now(), dur: 1100 },
            ];
        }, 850);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this.animTimer);
        clearInterval(this.ambientTimer);
    }

    override updated(changed: Map<string, unknown>) {
        if (changed.has("feed")) this.consumeFeed();
        if (changed.has("activeEventId") || changed.has("scenarioHint")) {
            const id = this.activeEventId;
            if (id) {
                // Narrative victim first, hash fallback second.
                const narrative = this.scenarioHint ? SCENARIO_VICTIM[this.scenarioHint] : undefined;
                this.victimIdx = narrative ?? hash(id) % PROTOS.length;
                this.attackFly = 0;
                this.attackFlyStart = 0;
                this.defensePackets = [];
                this.nodes = this.nodes.map((n, i) =>
                    i === this.victimIdx ? { state: "idle", attackedAt: null, shieldedAt: null, immuneAt: null } : n,
                );
            }
        }
    }

    private showBanner(b: Exclude<typeof this.banner, null>) {
        this.banner = b;
    }

    private consumeFeed() {
        // The feed is newest-first; walk oldest→newest and fold only new messages into state.
        const newEvents: EventEnvelope[] = [];
        for (const e of this.feed) {
            if (this.seenMsgIds.has(e.messageId)) break;
            newEvents.push(e);
        }
        if (newEvents.length === 0) return;

        const reversed = newEvents.reverse();
        let nodes = this.nodes;
        let hub = { ...this.hub };
        let packets = [...this.defensePackets];
        let attackFlyStart = this.attackFlyStart;
        let victim = this.victimIdx;

        for (const e of reversed) {
            this.seenMsgIds.add(e.messageId);
            if (this.seenMsgIds.size > 4096) {
                // bound memory
                this.seenMsgIds = new Set(Array.from(this.seenMsgIds).slice(-2048));
            }
            const data = e.data as Record<string, unknown>;
            const isActive = this.activeEventId && data.eventId === this.activeEventId;

            switch (e.kind) {
                case "PENDING_TX":
                    if (isActive) attackFlyStart = Date.now();
                    // Ambient scan sweep while mempool is being inspected (active and passive)
                    hub = { ...hub, scanUntil: Date.now() + 1600 };
                    break;
                case "THREAT_CANDIDATE":
                    hub = { ...hub, status: "THREAT CANDIDATE", statusColor: "#d47d27", scanUntil: Date.now() + 1200 };
                    break;
                case "THREAT_CONFIRMED": {
                    if (isActive || this.activeEventId === null) {
                        // Prefer narrative victim when we know the scenario, else hash fallback.
                        const narrative = this.scenarioHint ? SCENARIO_VICTIM[this.scenarioHint] : undefined;
                        const newVictim =
                            narrative ??
                            (typeof data.eventId === "string" ? hash(data.eventId) % PROTOS.length : victim);
                        victim = newVictim;
                        nodes = nodes.map((n, i) =>
                            i === newVictim ? { ...n, state: "attacked", attackedAt: Date.now() } : n,
                        );
                        hub = { ...hub, status: "THREAT CONFIRMED", statusColor: "#ff2244" };
                        this.showBanner({
                            kind: "threat",
                            title: "THREAT CONFIRMED",
                            sub: `${data.pattern ?? "UNKNOWN PATTERN"} · ${PROTOS[newVictim].name.toUpperCase()} AT RISK`,
                            until: Date.now() + 2600,
                        });
                    }
                    break;
                }
                case "DEFENSE_SUBMITTED":
                    packets.push({
                        id: e.messageId,
                        to: victim,
                        startedAt: Date.now(),
                        dur: 800,
                    });
                    hub = { ...hub, status: "DEFENSE SUBMITTED", statusColor: "#36c88b" };
                    break;
                case "DEFENSE_MINED":
                    nodes = nodes.map((n, i) =>
                        i === victim ? { ...n, state: "shielded", shieldedAt: Date.now() } : n,
                    );
                    hub = { ...hub, status: "DEFENSE MINED", statusColor: "#36c88b" };
                    break;
                case "PROVER_STARTED":
                    hub = { ...hub, status: "PROVER RUNNING", statusColor: "#c8ff00" };
                    break;
                case "PROVER_FINISHED":
                    hub = {
                        ...hub,
                        proofFlashUntil: Date.now() + 1400,
                        status: "PROOF VERIFIED",
                        statusColor: "#c8ff00",
                    };
                    break;
                case "LEDGER_RECORDED": {
                    hub = {
                        ...hub,
                        ledgerFlashUntil: Date.now() + 2000,
                        status: "LEDGER COMMITTED",
                        statusColor: "#00d9ff",
                    };
                    // Compute human-readable damage prevented for the payoff banner
                    let dollars = "";
                    try {
                        const d = data.damagePrevented;
                        if (typeof d === "string") {
                            const eth = Number(BigInt(d) / 10n ** 18n);
                            if (eth >= 1_000_000) dollars = ` · $${(eth / 1_000_000).toFixed(2)}M`;
                            else if (eth >= 1_000) dollars = ` · $${(eth / 1_000).toFixed(1)}K`;
                            else if (eth > 0) dollars = ` · $${eth.toFixed(0)}`;
                        }
                    } catch {
                        /* ignore */
                    }
                    const latencyStr = this.lastLatencyMs !== null ? ` · ${this.lastLatencyMs}MS` : "";
                    this.showBanner({
                        kind: "ledger",
                        title: `PROOF ON CHAIN${dollars}`,
                        sub: `COUNTERFACTUAL COMMITTED${latencyStr} · PREVENTED`,
                        until: Date.now() + 3600,
                    });
                    break;
                }
                case "PREEMPTIVE_SIGNATURE":
                    hub = { ...hub, broadcastUntil: Date.now() + 1600, status: "BROADCASTING", statusColor: "#c8ff00" };
                    break;
                case "FEDERATION_SYNC": {
                    // Map named peer → index if possible
                    const peer = typeof data.peer === "string" ? String(data.peer).toLowerCase() : null;
                    let idx = -1;
                    if (peer) {
                        idx = PROTOS.findIndex((p) => p.name.toLowerCase() === peer || p.short.toLowerCase() === peer);
                    }
                    if (idx < 0) idx = hash(e.messageId) % PROTOS.length;
                    if (idx !== victim) {
                        nodes = nodes.map((n, i) => (i === idx ? { ...n, state: "immune", immuneAt: Date.now() } : n));
                    }
                    break;
                }
                case "PREEMPTIVE_EXECUTED":
                    nodes = nodes.map((n, i) => (i === victim ? n : { ...n, state: "immune", immuneAt: Date.now() }));
                    hub = { ...hub, status: "IMMUNITY PROPAGATED", statusColor: "#c8ff00" };
                    break;
            }
        }

        this.nodes = nodes;
        this.hub = hub;
        this.defensePackets = packets;
        this.victimIdx = victim;
        if (attackFlyStart !== this.attackFlyStart) this.attackFlyStart = attackFlyStart;
    }

    /** Public API — let the parent force a reset (e.g. on manual run reset). */
    reset() {
        this.nodes = PROTOS.map(() => ({ state: "idle", attackedAt: null, shieldedAt: null, immuneAt: null }));
        this.hub = {
            proofFlashUntil: 0,
            ledgerFlashUntil: 0,
            broadcastUntil: 0,
            scanUntil: 0,
            status: "STANDBY",
            statusColor: "#9a9a9a",
        };
        this.defensePackets = [];
        this.attackFly = 0;
        this.attackFlyStart = 0;
    }

    // ── Renderers ──

    private renderBackdrop() {
        return svg`
      <defs>
        <radialGradient id="nm-hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#c8ff00" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#c8ff00" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="nm-hub-proof" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#c8ff00" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#c8ff00" stop-opacity="0"/>
        </radialGradient>
        <pattern id="nm-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#131313" stroke-width="0.3"/>
        </pattern>
        <filter id="nm-glow-red" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="nm-glow-green" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="nm-glow-chart" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="nm-glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="nm-scan-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="transparent"/>
          <stop offset="50%" stop-color="#00d9ff"/>
          <stop offset="100%" stop-color="transparent"/>
        </linearGradient>
      </defs>
      <rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#nm-grid)"/>
    `;
    }

    private renderScanLine() {
        if (this.now >= this.hub.scanUntil) return "";
        const dur = 1600;
        const t = 1 - Math.max(0, (this.hub.scanUntil - this.now) / dur);
        const y = t * VIEW_H;
        const opacity = Math.sin(t * Math.PI); // 0→1→0 over the sweep
        return svg`
      <rect x="0" y=${y.toFixed(1)} width=${VIEW_W} height="3"
        fill="url(#nm-scan-grad)" opacity=${opacity.toFixed(2)}/>
    `;
    }

    private renderSpokes() {
        const activeRun = !!this.activeEventId;
        return PROTOS.map((p, i) => {
            const n = this.nodes[i];
            const isVictim = i === this.victimIdx && activeRun;
            const isAttacked = n.state === "attacked";
            const isShielded = n.state === "shielded";
            const isImmune = n.state === "immune";
            const baseStroke = isAttacked
                ? "#ff2244"
                : isShielded
                  ? "#36c88b"
                  : isImmune
                    ? "#c8ff00"
                    : isVictim
                      ? "#d47d27"
                      : "#1a1a1a";
            const baseWidth = isAttacked || isShielded || isImmune ? 0.9 : 0.5;
            const baseOpacity = isAttacked ? 0.85 : isShielded ? 0.6 : isImmune ? 0.5 : isVictim ? 0.55 : 0.55;
            // Flow direction: for attacked spokes the "flow" comes from outside (victim → hub, threat inbound),
            // for shielded/immune it's outbound (hub → node).
            const animate = activeRun && (isAttacked || isShielded || isImmune || isVictim);
            return svg`
        <line x1=${p.x.toFixed(1)} y1=${p.y.toFixed(1)} x2=${CX} y2=${CY}
          stroke=${baseStroke} stroke-width=${baseWidth}
          stroke-dasharray="3 5" opacity=${baseOpacity.toFixed(2)}>
          ${
              animate
                  ? svg`
            <animate attributeName="stroke-dashoffset"
              from=${isAttacked || isVictim ? "0" : "-16"}
              to=${isAttacked || isVictim ? "-16" : "0"}
              dur="1.2s" repeatCount="indefinite"/>
          `
                  : ""
          }
        </line>
      `;
        });
    }

    private renderThreatLine() {
        // Glowing pulsing red line hub → victim while the attack phase is live.
        const victim = this.nodes[this.victimIdx];
        if (!victim || victim.state !== "attacked") return "";
        const p = PROTOS[this.victimIdx];
        return svg`
      <line x1=${CX} y1=${CY} x2=${p.x.toFixed(1)} y2=${p.y.toFixed(1)}
        stroke="#ff2244" stroke-width="2.2" opacity="0.9"
        filter="url(#nm-glow-red)">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="0.9s" repeatCount="indefinite"/>
      </line>
    `;
    }

    private renderHub() {
        const now = this.now;
        const proofActive = now < this.hub.proofFlashUntil;
        const ledgerActive = now < this.hub.ledgerFlashUntil;
        const broadcastActive = now < this.hub.broadcastUntil;

        // Broadcast wave — expanding circle
        let broadcast: ReturnType<typeof svg> | "" = "";
        if (broadcastActive) {
            const dur = 1600;
            const t = Math.min(1, (now - (this.hub.broadcastUntil - dur)) / dur);
            const r = 30 + t * (R + 20);
            const opacity = Math.max(0, 1 - t);
            broadcast = svg`
        <circle cx=${CX} cy=${CY} r=${r.toFixed(1)} fill="none"
          stroke="#c8ff00" stroke-width="1.2" opacity=${opacity.toFixed(2)}/>
        <circle cx=${CX} cy=${CY} r=${(r * 0.7).toFixed(1)} fill="none"
          stroke="#c8ff00" stroke-width="0.5" opacity=${(opacity * 0.55).toFixed(2)}/>
      `;
        }

        const idle = !this.activeEventId;

        return svg`
      ${broadcast}
      <circle cx=${CX} cy=${CY} r="120" fill="url(#nm-hub-glow)" opacity=${proofActive ? "1" : "0.65"}>
        ${idle ? svg`<animate attributeName="opacity" values="0.45;0.75;0.45" dur="3.6s" repeatCount="indefinite"/>` : ""}
      </circle>
      ${proofActive ? svg`<circle cx=${CX} cy=${CY} r="70" fill="url(#nm-hub-proof)"/>` : ""}
      <g filter=${proofActive ? "url(#nm-glow-chart)" : "none"}>
        <circle cx=${CX} cy=${CY} r="34"
          fill=${proofActive ? "rgba(200,255,0,0.14)" : "rgba(200,255,0,0.06)"}
          stroke="#c8ff00" stroke-width=${proofActive ? "1.6" : "1.0"}>
          ${idle ? svg`<animate attributeName="r" values="34;36;34" dur="3.6s" repeatCount="indefinite"/>` : ""}
        </circle>
        <text x=${CX} y=${CY - 4} text-anchor="middle"
          fill="#c8ff00" font-size="11" font-family="'IBM Plex Mono',monospace"
          font-weight="700" letter-spacing="0.14em">SNTL</text>
        <text x=${CX} y=${CY + 9} text-anchor="middle"
          fill="#8a8a8a" font-size="7" font-family="'IBM Plex Mono',monospace"
          letter-spacing="0.14em">REGISTRY</text>
      </g>
      ${
          ledgerActive
              ? svg`
        <g transform="translate(${CX + 24}, ${CY - 24})" filter="url(#nm-glow-cyan)">
          <circle r="9" fill="#00d9ff" opacity="0.14"/>
          <circle r="7" fill="#0a0a0a" stroke="#00d9ff" stroke-width="1"/>
          <path d="M-3,0 L-0.5,2.2 L3,-2" stroke="#00d9ff" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        </g>
      `
              : ""
      }
    `;
    }

    private renderNode(p: Protocol, i: number) {
        const n = this.nodes[i];
        const isVictim = i === this.victimIdx;
        const isAttacked = n.state === "attacked";
        const isShielded = n.state === "shielded";
        const isImmune = n.state === "immune";

        const stroke = isAttacked ? "#ff2244" : isShielded ? "#36c88b" : isImmune ? "#c8ff00" : "#2a2a2a";
        const fill = isAttacked
            ? "rgba(255,34,68,0.10)"
            : isShielded
              ? "rgba(54,200,139,0.08)"
              : isImmune
                ? "rgba(200,255,0,0.06)"
                : "#060606";
        const textColor = isAttacked ? "#ff5266" : isShielded ? "#36c88b" : isImmune ? "#c8ff00" : "#b8b8b8";

        // Shield plate for shielded/immune
        const shieldPlate =
            isShielded || isImmune
                ? svg`
      <path d=${`M${p.x - 22},${p.y - 18} L${p.x},${p.y - 26} L${p.x + 22},${p.y - 18} L${p.x + 22},${p.y + 8} Q${p.x + 22},${p.y + 20} ${p.x},${p.y + 26} Q${p.x - 22},${p.y + 20} ${p.x - 22},${p.y + 8} Z`}
        fill="none" stroke=${isShielded ? "#36c88b" : "#c8ff00"} stroke-width="0.8" opacity="0.55"/>
    `
                : "";

        // Pulse ring on attacked node
        const attackRing = isAttacked
            ? svg`
      <circle cx=${p.x.toFixed(1)} cy=${p.y.toFixed(1)} r="28" fill="none" stroke="#ff2244" stroke-width="1.2">
        <animate attributeName="r" from="18" to="40" dur="1.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.95" to="0" dur="1.2s" repeatCount="indefinite"/>
      </circle>
    `
            : "";

        // Victim marker on idle-but-targeted node (before THREAT_CONFIRMED lands)
        const victimMarker =
            isVictim && n.state === "idle" && this.activeEventId
                ? svg`
      <circle cx=${p.x.toFixed(1)} cy=${p.y.toFixed(1)} r="22" fill="none" stroke="#d47d27" stroke-width="0.6"
        stroke-dasharray="2 2" opacity="0.7"/>
    `
                : "";

        const glowFilter = isAttacked
            ? "url(#nm-glow-red)"
            : isShielded
              ? "url(#nm-glow-green)"
              : isImmune
                ? "url(#nm-glow-chart)"
                : "none";

        return svg`
      <g class="nm-node" filter=${glowFilter}>
        ${shieldPlate}
        ${attackRing}
        ${victimMarker}
        <rect x=${(p.x - 26).toFixed(1)} y=${(p.y - 14).toFixed(1)} width="52" height="28"
          fill=${fill} stroke=${stroke} stroke-width=${isAttacked || isShielded || isImmune ? "1.4" : "0.8"} rx="1.5"/>
        <text x=${p.x.toFixed(1)} y=${(p.y - 2).toFixed(1)} text-anchor="middle"
          fill=${textColor} font-size="9" font-family="'IBM Plex Mono',monospace"
          font-weight="700" letter-spacing="0.08em">${p.short}</text>
        <text x=${p.x.toFixed(1)} y=${(p.y + 8).toFixed(1)} text-anchor="middle"
          fill=${isAttacked ? "#ff5266" : isShielded ? "#36c88b" : isImmune ? "#c8ff00" : "#666"}
          font-size="6" font-family="'IBM Plex Mono',monospace">${this.liveTvls[p.short] ?? p.tvl}</text>
        ${
            isShielded || isImmune
                ? svg`
          <g transform="translate(${(p.x + 20).toFixed(1)}, ${(p.y - 16).toFixed(1)})">
            <circle r="6" fill="#0a0a0a" stroke=${isShielded ? "#36c88b" : "#c8ff00"} stroke-width="0.9"/>
            <path d="M-3,0 L-0.5,2 L3,-2" stroke=${isShielded ? "#36c88b" : "#c8ff00"} stroke-width="1.2" fill="none" stroke-linecap="round"/>
          </g>
        `
                : ""
        }
        ${
            isAttacked
                ? svg`
          <g transform="translate(${(p.x + 20).toFixed(1)}, ${(p.y - 16).toFixed(1)})">
            <circle r="6" fill="#0a0a0a" stroke="#ff2244" stroke-width="0.9"/>
            <text text-anchor="middle" y="2" fill="#ff2244"
              font-size="7" font-family="'IBM Plex Mono',monospace" font-weight="700">!</text>
          </g>
        `
                : ""
        }
      </g>
    `;
    }

    private renderAttackVector() {
        if (this.attackFly <= 0 || this.attackFly >= 1) {
            // Also show a faint arrival pulse for 400ms after reaching target
        }
        const victim = PROTOS[this.victimIdx];
        // Vector starts from outside the SVG (top-left corner) targeting the victim
        const start = { x: 20, y: 30 };
        const t = this.attackFly;
        if (t <= 0) return "";
        const x = start.x + (victim.x - start.x) * t;
        const y = start.y + (victim.y - start.y) * t;

        return svg`
      <g class="nm-vector">
        <line x1=${start.x} y1=${start.y} x2=${x.toFixed(1)} y2=${y.toFixed(1)}
          stroke="#ff2244" stroke-width="1" stroke-dasharray="3 4" opacity="0.55"/>
        <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">
          <circle r="7" fill="rgba(255,34,68,0.2)" stroke="#ff2244" stroke-width="1"/>
          <text text-anchor="middle" y="3" fill="#ff2244"
            font-size="8" font-family="'IBM Plex Mono',monospace" font-weight="700">!</text>
        </g>
      </g>
    `;
    }

    private renderAmbientPackets() {
        if (this.ambientPackets.length === 0) return "";
        const now = this.now;
        return this.ambientPackets.map((pk) => {
            const t = Math.max(0, Math.min(1, (now - pk.startedAt) / pk.dur));
            const target = PROTOS[pk.node];
            // Travel hub → node → hub (ping-pong) to suggest passive heartbeat
            const ping = t < 0.5 ? t * 2 : (1 - t) * 2;
            const x = CX + (target.x - CX) * ping;
            const y = CY + (target.y - CY) * ping;
            const opacity = Math.sin(t * Math.PI) * 0.55;
            return svg`
        <circle cx=${x.toFixed(1)} cy=${y.toFixed(1)} r="1.8"
          fill="#c8ff00" opacity=${opacity.toFixed(2)}/>
      `;
        });
    }

    private renderDefensePackets() {
        if (this.defensePackets.length === 0) return "";
        const now = this.now;
        return this.defensePackets.map((pk) => {
            const t = Math.max(0, Math.min(1, (now - pk.startedAt) / pk.dur));
            const target = PROTOS[pk.to];
            const x = CX + (target.x - CX) * t;
            const y = CY + (target.y - CY) * t;
            const opacity = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
            return svg`
        <line x1=${CX} y1=${CY} x2=${target.x.toFixed(1)} y2=${target.y.toFixed(1)}
          stroke="#36c88b" stroke-width="0.8" opacity="0.35"/>
        <circle cx=${x.toFixed(1)} cy=${y.toFixed(1)} r="3.5"
          fill="#36c88b" opacity=${opacity.toFixed(2)}/>
        <circle cx=${x.toFixed(1)} cy=${y.toFixed(1)} r="7"
          fill="none" stroke="#36c88b" stroke-width="0.6" opacity=${(opacity * 0.5).toFixed(2)}/>
      `;
        });
    }

    private get currentPhase(): "idle" | "threat" | "defense" | "immunity" {
        const immuneCount = this.nodes.filter((n) => n.state === "immune").length;
        const shieldedCount = this.nodes.filter((n) => n.state === "shielded").length;
        const attackedCount = this.nodes.filter((n) => n.state === "attacked").length;
        const proofActive = this.now < this.hub.proofFlashUntil;
        const ledgerActive = this.now < this.hub.ledgerFlashUntil;
        if (immuneCount > 0 || ledgerActive) return "immunity";
        if (shieldedCount > 0 || proofActive) return "defense";
        if (attackedCount > 0) return "threat";
        return "idle";
    }

    private renderPhaseStrip() {
        const phase = this.currentPhase;
        const PHASES = [
            { id: "idle", num: "01", label: "MONITORING" },
            { id: "threat", num: "02", label: "THREAT DETECTED" },
            { id: "defense", num: "03", label: "DEFENSE ACTIVE" },
            { id: "immunity", num: "04", label: "IMMUNITY PROPAGATED" },
        ] as const;
        const phaseOrder = ["idle", "threat", "defense", "immunity"];
        const currentIdx = phaseOrder.indexOf(phase);
        const immuneCount = this.nodes.filter((n) => n.state === "immune").length;
        const totalPeers = PROTOS.length - 1;
        const prevEth = this.totalPreventedEth;
        const fmtPrev =
            prevEth >= 1_000_000
                ? `$${(prevEth / 1_000_000).toFixed(2)}M`
                : prevEth >= 1_000
                  ? `$${(prevEth / 1_000).toFixed(1)}K`
                  : prevEth > 0
                    ? `$${prevEth.toFixed(0)}`
                    : null;

        return html`
      <div class="nm-phase-strip">
        <div class="nm-phase-steps">
          ${PHASES.map((p, i) => {
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              return html`
              <div class="nm-phase-step
                ${isDone ? "nm-phase-step--done" : ""}
                ${isActive ? "nm-phase-step--active" : ""}">
                <span class="nm-phase-step__num">${p.num}</span>
                <span class="nm-phase-step__label">${p.label}</span>
                <span class="nm-phase-step__mark">${isDone ? "✓" : isActive ? "●" : "○"}</span>
              </div>
            `;
          })}
        </div>
        <div class="nm-immunity-counter">
          <div class="nm-immunity-counter__val">
            <span class="nm-immunity-counter__num"
              style="color:${immuneCount === totalPeers && totalPeers > 0 ? "#c8ff00" : immuneCount > 0 ? "rgba(200,255,0,0.7)" : "#444"}">
              ${immuneCount}
            </span>
            <span class="nm-immunity-counter__den">/ ${totalPeers}</span>
          </div>
          <div class="nm-immunity-counter__label">PROTOCOLS IMMUNE</div>
          ${
              fmtPrev
                  ? html`
            <div class="nm-immunity-counter__prevented">${fmtPrev} PREVENTED</div>
          `
                  : ""
          }
        </div>
      </div>
    `;
    }

    private renderBanner() {
        if (!this.banner) return nothing;
        const { kind, title, sub } = this.banner;
        return html`
      <div class="nm-banner nm-banner--${kind}" role="status" aria-live="polite">
        <div class="nm-banner__title">${title}</div>
        <div class="nm-banner__sub">${sub}</div>
      </div>
    `;
    }

    override render() {
        const victim = PROTOS[this.victimIdx];
        const attackedCount = this.nodes.filter((n) => n.state === "attacked").length;
        const shieldedCount = this.nodes.filter((n) => n.state === "shielded").length;
        const immuneCount = this.nodes.filter((n) => n.state === "immune").length;
        const idle = !this.activeEventId;

        return html`
      <div class="panel nm-panel">
        <div class="panel-header nm-header">
          <span class="panel-label">NETWORK MESH — ${this.mode === "live" ? "LIVE" : "SIMULATED"}</span>
          <span class="panel-code nm-status" style="color:${this.hub.statusColor}">
            <span class="nm-status__dot" style="background:${this.hub.statusColor}"></span>
            ${this.hub.status}
          </span>
        </div>
        <div class="nm-stage">
          <svg class="nm-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}"
               preserveAspectRatio="xMidYMid meet"
               role="img" aria-label="Live network mesh visualization">
            ${this.renderBackdrop()}
            ${this.renderScanLine()}
            ${this.renderSpokes()}
            ${this.renderThreatLine()}
            ${this.renderHub()}
            ${this.renderAmbientPackets()}
            ${this.renderDefensePackets()}
            ${this.renderAttackVector()}
            ${PROTOS.map((p, i) => this.renderNode(p, i))}
          </svg>
          ${this.renderBanner()}
        </div>
        ${this.renderPhaseStrip()}
        <div class="nm-telemetry">
          <div class="nm-tel__cell">
            <div class="nm-tel__k">${idle ? "MODE" : "VICTIM"}</div>
            <div class="nm-tel__v" style="color:${idle ? "#c8ff00" : this.nodes[this.victimIdx]?.state === "attacked" ? "#ff5266" : this.nodes[this.victimIdx]?.state === "shielded" ? "#36c88b" : "#e8e8e8"}">
              ${idle ? "MONITORING" : victim.name.toUpperCase()}
            </div>
          </div>
          <div class="nm-tel__cell">
            <div class="nm-tel__k">${idle ? "MEMPOOL (5s)" : "ATTACKED"}</div>
            <div class="nm-tel__v" style="color:${idle ? "#e8e8e8" : "#ff5266"}">
              ${idle ? `${this.mempoolDepth} TX` : attackedCount}
            </div>
          </div>
          <div class="nm-tel__cell">
            <div class="nm-tel__k">SHIELDED</div>
            <div class="nm-tel__v" style="color:#36c88b">${shieldedCount}</div>
          </div>
          <div class="nm-tel__cell">
            <div class="nm-tel__k">IMMUNE (PEERS)</div>
            <div class="nm-tel__v" style="color:#c8ff00">${immuneCount} / ${PROTOS.length - 1}</div>
          </div>
          <div class="nm-tel__cell">
            <div class="nm-tel__k">NODES IN MESH</div>
            <div class="nm-tel__v">${PROTOS.length}</div>
          </div>
        </div>
      </div>
    `;
    }
}
