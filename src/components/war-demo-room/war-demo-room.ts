import { LitElement, html, nothing, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import { api, ping } from "../../lib/api";
import { type LiveMetricsSnapshot, TRACKED_SERVICES, liveMetrics } from "../../lib/live-metrics";
import { ATTACKER_SCENARIOS, SCENARIOS, type Scenario, playScenario, startAmbientNoise } from "../../lib/simulator";
import { type TvlMap, fetchLiveTvls } from "../../lib/tvl";
import { type EventEnvelope, SentinelSocket, type WsStatus } from "../../lib/ws";
import "./war-demo-room.css";

type SourceMode = "probing" | "live" | "simulation";

type PipelinePhase = "mempool" | "detection" | "defense" | "proof" | "ledger";

interface RunState {
    eventId: string | null;
    scenario: Scenario | null;
    startedAt: number;
    reached: Record<PipelinePhase, number | null>; // ms since start at which phase was observed
    damagePrevented: number;
    txHashes: { attacker?: string; defense?: string; ledger?: string };
}

const EMPTY_RUN: RunState = {
    eventId: null,
    scenario: null,
    startedAt: 0,
    reached: { mempool: null, detection: null, defense: null, proof: null, ledger: null },
    damagePrevented: 0,
    txHashes: {},
};

const PHASE_ORDER: PipelinePhase[] = ["mempool", "detection", "defense", "proof", "ledger"];

const PHASE_LABEL: Record<PipelinePhase, string> = {
    mempool: "MEMPOOL",
    detection: "DETECTION",
    defense: "DEFENSE TX",
    proof: "ZK PROOF",
    ledger: "LEDGER",
};

const PHASE_CODE: Record<PipelinePhase, string> = {
    mempool: "PENDING_TX",
    detection: "THREAT_CONFIRMED",
    defense: "DEFENSE_MINED",
    proof: "PROVER_FINISHED",
    ledger: "LEDGER_RECORDED",
};

const MAX_FEED = 80;

/** Map a raw envelope kind to the pipeline phase it completes, if any. */
function kindToPhase(kind: string): PipelinePhase | null {
    switch (kind) {
        case "PENDING_TX":
            return "mempool";
        case "THREAT_CONFIRMED":
            return "detection";
        case "DEFENSE_MINED":
            return "defense";
        case "PROVER_FINISHED":
            return "proof";
        case "LEDGER_RECORDED":
            return "ledger";
        default:
            return null;
    }
}

function shortHash(h: string | undefined | null, head = 6, tail = 4): string {
    if (!h || typeof h !== "string") return "—";
    if (h.length <= head + tail + 1) return h;
    return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

function fmtUsd(wei: string | number | undefined): string {
    if (wei === undefined || wei === null) return "—";
    const n = typeof wei === "number" ? wei : Number(BigInt(String(wei)) / 10n ** 18n);
    if (!Number.isFinite(n)) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

@customElement("war-demo-room")
export class WarDemoRoom extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private mode: SourceMode = "probing";
    @state() private wsStatus: WsStatus = "closed";
    @state() private feed: EventEnvelope[] = [];
    @state() private run: RunState = { ...EMPTY_RUN, reached: { ...EMPTY_RUN.reached } };
    @state() private running = false;
    @state() private busyScenario: Scenario | null = null;
    // Session (local) counters — shown when live stats haven't bootstrapped yet.
    @state() private sessionThreats = 0;
    @state() private sessionPrevented = 0;
    @state() private sessionAvgMs = 0;
    @state() private lastLatency: number | null = null;
    // Fallback local block counter — overridden by liveMetrics.blockHeight when available.
    @state() private localBlockNum = 19284531;
    @state() private now = Date.now();
    @state() private errorMsg: string | null = null;
    // Live-metrics snapshot (null until first poll completes).
    @state() private metrics: LiveMetricsSnapshot = liveMetrics.current;
    // Rolling mempool depth window — ~5s of recent PENDING_TX emittedAt timestamps.
    @state() private mempoolWindow: number[] = [];
    // Live TVL map from DefiLlama, if enabled; otherwise empty → mesh uses compiled labels.
    @state() private liveTvls: TvlMap = {};

    private socket: SentinelSocket | null = null;
    private unsubSocket?: () => void;
    private unsubStatus?: () => void;
    private unsubMetrics?: () => void;
    private cancelScenario: (() => void) | null = null;
    private cancelAmbient: (() => void) | null = null;
    private blockTimer = 0;
    private clockTimer = 0;
    private respSum = 0;
    private respCount = 0;

    override connectedCallback() {
        super.connectedCallback();
        // Fallback local block counter — only visible while liveMetrics.blockHeight is null
        this.blockTimer = window.setInterval(() => {
            this.localBlockNum++;
        }, 12000);
        this.clockTimer = window.setInterval(() => {
            this.now = Date.now();
        }, 250);
        // Live backend polling (block height, service health, historical stats)
        liveMetrics.start();
        this.unsubMetrics = liveMetrics.onUpdate((s) => {
            this.metrics = s;
        });
        // DefiLlama TVLs — opt-in via VITE_USE_LIVE_TVL=1; no-op otherwise.
        fetchLiveTvls().then((m) => {
            if (Object.keys(m).length > 0) this.liveTvls = m;
        });
        this.probeAndConnect();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this.blockTimer);
        clearInterval(this.clockTimer);
        this.unsubMetrics?.();
        this.teardown();
    }

    private teardown() {
        this.unsubSocket?.();
        this.unsubStatus?.();
        this.socket?.close();
        this.socket = null;
        this.cancelScenario?.();
        this.cancelScenario = null;
        this.cancelAmbient?.();
        this.cancelAmbient = null;
    }

    private async probeAndConnect() {
        const alive = await ping();
        if (alive) {
            this.mode = "live";
            this.connectSocket();
        } else {
            this.mode = "simulation";
            this.startSimulation();
        }
    }

    private connectSocket() {
        const sock = new SentinelSocket(["events.all"]);
        this.socket = sock;
        this.unsubStatus = sock.onStatus((s) => {
            this.wsStatus = s;
        });
        this.unsubSocket = sock.onEvent((env) => this.handleEvent(env));
        sock.connect();
    }

    private startSimulation() {
        this.cancelAmbient?.();
        this.cancelAmbient = startAmbientNoise((env) => this.handleEvent(env));
    }

    private switchMode(target: SourceMode) {
        if (target === this.mode) return;
        this.teardown();
        this.mode = target;
        this.feed = [];
        if (target === "live") this.connectSocket();
        else if (target === "simulation") this.startSimulation();
    }

    private handleEvent(envEvt: EventEnvelope) {
        // Push to feed (drop oldest)
        const nextFeed = [envEvt, ...this.feed];
        if (nextFeed.length > MAX_FEED) nextFeed.length = MAX_FEED;
        this.feed = nextFeed;

        // Rolling mempool window — bound to last 50 timestamps for cheap updates.
        if (envEvt.kind === "PENDING_TX") {
            const now = Date.now();
            const next = [now, ...this.mempoolWindow].slice(0, 50);
            this.mempoolWindow = next;
        }

        const data = envEvt.data as Record<string, unknown>;
        const eventId = data.eventId as string | undefined;
        const phase = kindToPhase(envEvt.kind);
        const belongsToRun = this.run.eventId && eventId === this.run.eventId;

        if (belongsToRun) {
            const elapsed = Date.now() - this.run.startedAt;
            let { damagePrevented, txHashes, reached } = this.run;

            if (phase && reached[phase] === null) {
                reached = { ...reached, [phase]: elapsed };
            }
            if (envEvt.kind === "LEDGER_RECORDED" || envEvt.kind === "COUNTERFACTUAL_READY") {
                const d = data.damagePrevented;
                if (typeof d === "string") {
                    try {
                        damagePrevented = Number(BigInt(d) / 10n ** 18n);
                    } catch {}
                }
            }
            if (envEvt.kind === "DEFENSE_SUBMITTED" && typeof data.txHash === "string") {
                txHashes = { ...txHashes, defense: data.txHash };
            }
            if (envEvt.kind === "LEDGER_RECORDED" && typeof data.txHash === "string") {
                txHashes = { ...txHashes, ledger: data.txHash };
            }

            this.run = { ...this.run, reached, damagePrevented, txHashes };

            if (envEvt.kind === "LEDGER_RECORDED") {
                this.finalizeRun(elapsed, damagePrevented);
            }
        }

        // Capture the first PENDING_TX after a run starts as the attacker tx if none seen yet
        if (envEvt.kind === "PENDING_TX" && this.run.eventId && !this.run.txHashes.attacker) {
            const h = typeof data.txHash === "string" ? data.txHash : undefined;
            if (h) this.run = { ...this.run, txHashes: { ...this.run.txHashes, attacker: h } };
        }

        // Let any external feed watchers inspect the event (used for eventId adoption)
        if (this.feedWatchers.size > 0) {
            for (const w of this.feedWatchers) w(envEvt);
        }
    }

    private finalizeRun(elapsed: number, damagePrevented: number) {
        this.running = false;
        this.busyScenario = null;
        this.sessionThreats += 1;
        this.sessionPrevented += damagePrevented;
        this.lastLatency = elapsed;
        this.respSum += elapsed;
        this.respCount += 1;
        this.sessionAvgMs = Math.round(this.respSum / this.respCount);
        // Nudge live-metrics to refresh so historical counters reflect this run.
        liveMetrics.refresh();
    }

    /** Effective display values: prefer live backend stats once bootstrapped, else fall back to session counters. */
    private get displayedThreats(): number {
        const live = this.metrics.stats;
        return this.metrics.bootstrapped && live.sampleSize > 0 ? live.totalThreats : this.sessionThreats;
    }
    private get displayedPrevented(): number {
        const live = this.metrics.stats;
        return this.metrics.bootstrapped && live.sampleSize > 0 ? live.totalPreventedEth : this.sessionPrevented;
    }
    private get displayedAvgMs(): number {
        const live = this.metrics.stats;
        return this.metrics.bootstrapped && live.sampleSize > 0 ? live.avgResponseMs : this.sessionAvgMs;
    }
    private get displayedBlock(): number {
        return this.metrics.health.blockHeight ?? this.localBlockNum;
    }
    private get displayedStatsSource(): "live" | "session" | "none" {
        if (this.metrics.bootstrapped && this.metrics.stats.sampleSize > 0) return "live";
        if (this.sessionThreats > 0) return "session";
        return "none";
    }

    /** Rolling mempool depth: PENDING_TX events received in the last 5 seconds. */
    private get mempoolDepth(): number {
        const cutoff = Date.now() - 5000;
        return this.mempoolWindow.filter((t) => t >= cutoff).length;
    }

    /** Median gas price (gwei) across the last 20 PENDING_TX envelopes in the feed. */
    private get medianGasGwei(): number | null {
        const gases: number[] = [];
        for (const e of this.feed) {
            if (e.kind !== "PENDING_TX") continue;
            const g = (e.data as Record<string, unknown>).gasPrice;
            const n = typeof g === "string" ? Number(g) : typeof g === "number" ? g : NaN;
            if (Number.isFinite(n) && n > 0) gases.push(n);
            if (gases.length >= 20) break;
        }
        if (gases.length === 0) return null;
        gases.sort((a, b) => a - b);
        return Math.round(gases[Math.floor(gases.length / 2)]);
    }

    private async launch(scenario: Scenario) {
        if (this.running) return;
        this.errorMsg = null;
        this.cancelScenario?.();
        this.run = {
            ...EMPTY_RUN,
            reached: { mempool: null, detection: null, defense: null, proof: null, ledger: null },
            scenario,
            startedAt: Date.now(),
            txHashes: {},
        };
        this.running = true;
        this.busyScenario = scenario;

        if (this.mode === "live") {
            try {
                let eventId: string | null = null;
                if (scenario === "flash-loan") {
                    const r = await api.replayScenario();
                    if (!r.replayStarted) throw new Error(r.error ?? "replay failed");
                    // eventId isn't returned here; we match by looking for the next THREAT_CONFIRMED
                    eventId = null;
                } else if (scenario === "preemptive") {
                    const r = await api.preemptive();
                    if (!r.preemptive) throw new Error(r.error ?? "preemptive failed");
                    eventId = r.eventId;
                } else if (scenario === "inject-instruction") {
                    const r = await api.injectInstruction();
                    eventId = r.eventId;
                } else if (ATTACKER_SCENARIOS.has(scenario)) {
                    // Python-backed scenarios: spawn the attacker process server-side.
                    // The detection/defense pipeline picks the txs up via mempool-monitor
                    // and we adopt the next THREAT_CONFIRMED eventId off the live feed.
                    const r = await api.runScenario(scenario);
                    if (!r.scenarioStarted) throw new Error(r.error ?? "scenario launch failed");
                    eventId = null;
                }
                if (eventId) this.run = { ...this.run, eventId };
                else {
                    // For replay-scenario we adopt the next confirmed eventId we see
                    this.adoptNextEventId();
                }
                // Safety timeout — scale with the scenario's runtime budget.
                const meta = SCENARIOS.find((s) => s.id === scenario);
                const stallMs = (meta?.estMs ?? 8000) + 15000;
                window.setTimeout(() => {
                    if (this.running && this.run.reached.ledger === null) {
                        this.running = false;
                        this.busyScenario = null;
                        // `routine` is expected to NOT produce a ledger event — treat
                        // silence as success rather than stall.
                        if (scenario === "routine") {
                            this.errorMsg = null;
                        } else {
                            this.errorMsg = "run stalled — backend did not complete the pipeline";
                        }
                    }
                }, stallMs);
            } catch (err) {
                this.running = false;
                this.busyScenario = null;
                this.errorMsg = `live scenario failed: ${(err as Error).message}. switching to simulation…`;
                this.switchMode("simulation");
                window.setTimeout(() => this.launch(scenario), 500);
            }
        } else {
            // Simulation — we own the eventId
            const simEventId = this.nextSimEventId();
            this.run = { ...this.run, eventId: simEventId };
            this.cancelScenario = playScenario(
                scenario,
                (simEnv) => {
                    // Inject our known eventId into emits for this run (simulator generates its own)
                    const d = simEnv.data as Record<string, unknown>;
                    const patched: EventEnvelope = d.eventId
                        ? { ...simEnv, data: { ...d, eventId: simEventId } }
                        : simEnv;
                    this.handleEvent(patched);
                },
                this.displayedBlock,
            );

            // Safety finalize: benign scenarios like `routine` never emit a
            // LEDGER_RECORDED event, so `handleEvent` won't call finalizeRun().
            // Release the busy state after the scenario's runtime so the user
            // can launch another one.
            const meta = SCENARIOS.find((s) => s.id === scenario);
            const settleMs = (meta?.estMs ?? 8000) + 500;
            window.setTimeout(() => {
                if (this.running && this.busyScenario === scenario) {
                    this.running = false;
                    this.busyScenario = null;
                }
            }, settleMs);
        }
    }

    private adoptNextEventId() {
        // Watch the feed for the next THREAT_CONFIRMED and adopt its eventId.
        const start = Date.now();
        const unsub = this.addFeedWatcher((envEvt) => {
            if (envEvt.kind === "THREAT_CONFIRMED") {
                const id = (envEvt.data as Record<string, unknown>).eventId;
                if (typeof id === "string") {
                    this.run = { ...this.run, eventId: id };
                    unsub();
                }
            }
            if (Date.now() - start > 10000) unsub();
        });
    }

    private feedWatchers = new Set<(e: EventEnvelope) => void>();
    private addFeedWatcher(fn: (e: EventEnvelope) => void): () => void {
        this.feedWatchers.add(fn);
        return () => this.feedWatchers.delete(fn);
    }

    private nextSimEventId(): string {
        const arr = new Uint8Array(32);
        crypto.getRandomValues(arr);
        return "0x" + Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
    }

    private resetRun() {
        this.cancelScenario?.();
        this.cancelScenario = null;
        this.running = false;
        this.busyScenario = null;
        this.run = {
            ...EMPTY_RUN,
            reached: { mempool: null, detection: null, defense: null, proof: null, ledger: null },
            txHashes: {},
        };
        this.errorMsg = null;
    }

    // ── Renderers ──

    private renderHeader() {
        const modeColor = this.mode === "live" ? "#c8ff00" : this.mode === "simulation" ? "#00d9ff" : "#d47d27";
        const modeLabel =
            this.mode === "live"
                ? this.wsStatus === "open"
                    ? "LIVE"
                    : "LIVE · " + this.wsStatus.toUpperCase()
                : this.mode === "simulation"
                  ? "SIMULATION"
                  : "PROBING…";
        return html`
      <div class="wr-header">
        <div class="wr-header__left">
          <a href="#/dashboard" class="wr-header__back" @click=${(e: Event) => {
              e.preventDefault();
              window.location.hash = "#/dashboard";
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
            <span class="wr-header__badge">WAR DEMO ROOM</span>
          </div>
        </div>
        <div class="wr-status-bar">
          <div class="wr-status-item">
            <span class="status-dot" style="background:${modeColor};box-shadow:0 0 10px ${modeColor}66"></span>
            <span class="wr-status-label">SOURCE</span>
            <span class="wr-status-value" style="color:${modeColor}">${modeLabel}</span>
          </div>
          <div class="wr-status-item">
            <span class="wr-status-label">BLOCK</span>
            <span class="wr-status-value" title=${this.metrics.health.blockHeight ? "from eth_blockNumber via /api/v1/health" : "simulated counter — gateway unreachable"}>#${this.displayedBlock}</span>
          </div>
          <div class="wr-status-item">
            <span class="wr-status-label">MEMPOOL (5s)</span>
            <span class="wr-status-value">${this.mempoolDepth} TX</span>
          </div>
          <div class="wr-status-item">
            <span class="wr-status-label">GAS</span>
            <span class="wr-status-value">${this.medianGasGwei !== null ? this.medianGasGwei + " gwei" : "—"}</span>
          </div>
          <div class="wr-status-item">
            <span class="wr-status-label">THREATS STOPPED</span>
            <span class="wr-status-value" style="color:#c8ff00" title=${this.displayedStatsSource === "live" ? "persisted from /api/v1/events" : "this session"}>${this.displayedThreats}${this.displayedStatsSource === "live" ? "" : this.sessionThreats > 0 ? " ·" : ""}</span>
          </div>
          ${this.renderServiceHealth()}
          <div class="wr-status-item wdr-mode-seg" role="radiogroup" aria-label="Data source">
            <button
              class="wdr-seg ${this.mode === "live" ? "wdr-seg--active" : ""}"
              role="radio"
              aria-checked=${this.mode === "live"}
              @click=${() => this.switchMode("live")}
            >LIVE</button>
            <button
              class="wdr-seg ${this.mode === "simulation" ? "wdr-seg--active" : ""}"
              role="radio"
              aria-checked=${this.mode === "simulation"}
              @click=${() => this.switchMode("simulation")}
            >SIM</button>
          </div>
          <div class="wr-status-item">
            <a class="wdr-attacker-link" href="#/attacker" @click=${(e: Event) => {
                e.preventDefault();
                window.location.hash = "#/attacker";
            }}>
              ATTACKER BRIEF ▶
            </a>
          </div>
        </div>
      </div>
    `;
    }

    private renderControls() {
        return html`
      <div class="panel wdr-controls">
        <div class="panel-header">
          <span class="panel-label">SCENARIO LAUNCHER</span>
          <span class="panel-code">${this.running ? "IN PROGRESS" : "READY"}</span>
        </div>
        <div class="wdr-control-grid">
          ${SCENARIOS.map((s) => {
              const disabled = this.running;
              const busy = this.busyScenario === s.id;
              return html`
              <button
                class="wdr-scenario ${busy ? "wdr-scenario--busy" : ""}"
                ?disabled=${disabled}
                @click=${() => this.launch(s.id)}
              >
                <div class="wdr-scenario__head">
                  <span class="wdr-scenario__sev wdr-scenario__sev--${s.severity.toLowerCase()}">${s.severity}</span>
                  <span class="wdr-scenario__eta">${(s.estMs / 1000).toFixed(1)}s</span>
                </div>
                <div class="wdr-scenario__label">${s.label}</div>
                <div class="wdr-scenario__desc">${s.description}</div>
                <div class="wdr-scenario__cta">${busy ? "RUNNING…" : "LAUNCH ▶"}</div>
              </button>
            `;
          })}
        </div>
        ${this.errorMsg ? html`<div class="wdr-error">${this.errorMsg}</div>` : nothing}
      </div>
    `;
    }

    private renderPipeline() {
        const elapsed = this.running ? this.now - this.run.startedAt : (this.lastLatency ?? 0);
        const done = (phase: PipelinePhase) => this.run.reached[phase] !== null;
        const activePhase = (() => {
            if (!this.run.scenario) return null;
            for (const p of PHASE_ORDER) if (!done(p)) return p;
            return null;
        })();

        return html`
      <div class="panel wdr-pipeline">
        <div class="panel-header">
          <span class="panel-label">ATTACK PIPELINE</span>
          <span class="panel-code">
            ${
                this.run.scenario
                    ? `${this.run.scenario.toUpperCase().replace("-", "_")} · ${this.running ? (elapsed / 1000).toFixed(2) + "s" : "DONE"}`
                    : "IDLE — launch a scenario above"
            }
          </span>
        </div>
        <div class="wdr-pipeline__body">
          ${PHASE_ORDER.map((p, i) => {
              const ms = this.run.reached[p];
              const isDone = ms !== null;
              const isActive = activePhase === p && this.running;
              return html`
              <div class="wdr-phase ${isDone ? "wdr-phase--done" : ""} ${isActive ? "wdr-phase--active" : ""}">
                <div class="wdr-phase__num">${String(i + 1).padStart(2, "0")}</div>
                <div class="wdr-phase__label">${PHASE_LABEL[p]}</div>
                <div class="wdr-phase__code">${PHASE_CODE[p]}</div>
                <div class="wdr-phase__ms">${isDone ? `+${ms}ms` : isActive ? "WAITING" : "—"}</div>
              </div>
              ${i < PHASE_ORDER.length - 1 ? html`<div class="wdr-phase__link ${isDone ? "wdr-phase__link--done" : ""}"></div>` : nothing}
            `;
          })}
        </div>
        <div class="wdr-pipeline__details">
          <div><span class="wdr-kv__k">EVENT ID</span><span class="wdr-kv__v">${shortHash(this.run.eventId, 10, 6)}</span></div>
          <div><span class="wdr-kv__k">ATTACKER TX</span><span class="wdr-kv__v">${shortHash(this.run.txHashes.attacker, 10, 6)}</span></div>
          <div><span class="wdr-kv__k">DEFENSE TX</span><span class="wdr-kv__v">${shortHash(this.run.txHashes.defense, 10, 6)}</span></div>
          <div><span class="wdr-kv__k">DAMAGE PREVENTED</span><span class="wdr-kv__v" style="color:#c8ff00">${fmtUsd(this.run.damagePrevented)}</span></div>
        </div>
      </div>
    `;
    }

    private renderMetrics() {
        return html`
      <div class="wr-grid-4 wdr-metric-grid">
        <div class="wr-metric-card">
          <div class="wr-metric-card__label">TOTAL PREVENTED</div>
          <div class="wr-metric-card__value">${fmtUsd(this.displayedPrevented)}</div>
          <div class="wr-metric-card__delta" style="color:#36c88b">${this.displayedStatsSource === "live" ? `from /events · n=${this.metrics.stats.sampleSize}` : "this session"}</div>
        </div>
        <div class="wr-metric-card">
          <div class="wr-metric-card__label">THREATS STOPPED</div>
          <div class="wr-metric-card__value">${this.displayedThreats}</div>
          <div class="wr-metric-card__delta" style="color:#36c88b">${this.displayedThreats > 0 ? "100% success" : "—"}</div>
        </div>
        <div class="wr-metric-card">
          <div class="wr-metric-card__label">LAST RESPONSE</div>
          <div class="wr-metric-card__value">${this.lastLatency !== null ? this.lastLatency + "ms" : "—"}</div>
          <div class="wr-metric-card__delta" style="color:#c8ff00">
            ${this.lastLatency !== null ? (this.lastLatency < 2000 ? "sub-block" : "next-block") : "idle"}
          </div>
        </div>
        <div class="wr-metric-card">
          <div class="wr-metric-card__label">AVG RESPONSE</div>
          <div class="wr-metric-card__value">${this.displayedAvgMs > 0 ? this.displayedAvgMs + "ms" : "—"}</div>
          <div class="wr-metric-card__delta" style="color:#666">${this.displayedStatsSource === "live" ? `n=${this.metrics.stats.sampleSize}` : `n=${this.respCount}`}</div>
        </div>
      </div>
    `;
    }

    /**
     * Compact service-health strip in the status bar.
     * Each service is a dot; hover shows the name + status. Keeps the demo
     * honest — if the zk-prover is down during a live run, you see it.
     */
    private renderServiceHealth() {
        const svcs = this.metrics.health.services;
        const gatewayUp = this.metrics.health.gatewayUp;
        return html`
      <div class="wr-status-item wdr-health-strip" aria-label="Service health">
        <span class="wr-status-label">SVCS</span>
        ${TRACKED_SERVICES.map((s) => {
            const status = svcs[s] ?? "unknown";
            const color = !gatewayUp ? "#444" : status === "up" ? "#36c88b" : status === "down" ? "#ff2244" : "#666";
            return html`
            <span
              class="wdr-health-dot"
              title="${s}: ${gatewayUp ? status : "gateway unreachable"}"
              style="background:${color};box-shadow:${gatewayUp && status === "up" ? `0 0 6px ${color}` : "none"}"
            ></span>
          `;
        })}
      </div>
    `;
    }

    private renderFeed() {
        return html`
      <div class="panel wdr-feed">
        <div class="panel-header">
          <span class="panel-label">LIVE EVENT FIREHOSE</span>
          <span class="panel-code">${this.mode === "live" ? "WS :: /ws" : "SIMULATED STREAM"}</span>
        </div>
        <div class="wdr-feed__rows">
          ${
              this.feed.length === 0
                  ? html`
            <div class="wdr-feed__empty">waiting for events…</div>
          `
                  : this.feed.map((ev) => this.renderFeedRow(ev))
          }
        </div>
      </div>
    `;
    }

    private renderFeedRow(ev: EventEnvelope) {
        const data = ev.data as Record<string, unknown>;
        const t = new Date(ev.emittedAt);
        const time = `${t.getMinutes().toString().padStart(2, "0")}:${t.getSeconds().toString().padStart(2, "0")}.${t.getMilliseconds().toString().padStart(3, "0")}`;
        const isActiveRun = this.run.eventId && data.eventId === this.run.eventId;

        let summary: string = "";
        switch (ev.kind) {
            case "PENDING_TX":
                summary = `from ${shortHash(data.from as string)} → ${shortHash(data.to as string)}`;
                break;
            case "THREAT_CANDIDATE":
            case "THREAT_CONFIRMED":
                summary = `${data.pattern ?? "?"} · conf ${data.confidence ?? "?"}`;
                break;
            case "DEFENSE_SUBMITTED":
                summary = `tx ${shortHash(data.txHash as string)}`;
                break;
            case "DEFENSE_MINED":
                summary = `block #${data.blockNumber ?? "?"}`;
                break;
            case "PROVER_STARTED":
            case "PROVER_FINISHED":
                summary = `${data.circuit ?? "circuit"}${data.gasUsed ? " · " + data.gasUsed + " gas" : ""}`;
                break;
            case "COUNTERFACTUAL_READY":
                summary = `root ${shortHash(data.counterfactualRoot as string)}`;
                break;
            case "LEDGER_RECORDED":
                summary = `prevented ${fmtUsd(data.damagePrevented as string)}`;
                break;
            case "PREEMPTIVE_SIGNATURE":
                summary = `${data.pattern ?? "?"} → ${data.peers ?? "?"} peers`;
                break;
            case "FEDERATION_SYNC":
                summary = `peer ${data.peer ?? "?"}`;
                break;
            default:
                summary = Object.keys(data).slice(0, 3).join(",");
        }

        return html`
      <div class="wdr-evt ${isActiveRun ? "wdr-evt--active" : ""}">
        <div class="wdr-evt__time">${time}</div>
        <div class="wdr-evt__kind wdr-evt__kind--${ev.kind.toLowerCase().replace(/_/g, "-")}">${ev.kind}</div>
        <div class="wdr-evt__summary">${summary}</div>
      </div>
    `;
    }

    private renderTimeline() {
        // Tiny visual block ribbon showing where events landed
        const width = 960;
        const height = 48;
        const windowMs = 10000;
        const nowMs = this.now;
        const events = this.feed.filter((e) => nowMs - new Date(e.emittedAt).getTime() < windowMs);
        return html`
      <div class="panel wdr-timeline">
        <div class="panel-header">
          <span class="panel-label">10s ACTIVITY WINDOW</span>
          <span class="panel-code">${events.length} EVT</span>
        </div>
        <div class="wdr-timeline__svg-wrap">
          ${svg`
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="wdr-timeline__svg">
              <line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="#1a1a1a" stroke-width="0.5"/>
              ${events.map((e) => {
                  const age = nowMs - new Date(e.emittedAt).getTime();
                  const x = width - (age / windowMs) * width;
                  const color =
                      e.kind === "PENDING_TX"
                          ? "#666"
                          : e.kind.startsWith("THREAT")
                            ? "#ff2244"
                            : e.kind.startsWith("DEFENSE")
                              ? "#36c88b"
                              : e.kind.startsWith("PROVER")
                                ? "#c8ff00"
                                : e.kind === "LEDGER_RECORDED"
                                  ? "#00d9ff"
                                  : "#444";
                  return svg`<circle cx="${x}" cy="${height / 2}" r="3" fill="${color}" opacity="0.9"/>`;
              })}
            </svg>
          `}
        </div>
      </div>
    `;
    }

    override render() {
        return html`
      <div class="war-room war-demo-room">
        ${this.renderHeader()}
        <div class="wr-content wdr-content">
          <network-map
            class="wdr-hero-map"
            .feed=${this.feed}
            .activeEventId=${this.run.eventId}
            .mode=${this.mode}
            .scenarioHint=${this.run.scenario}
            .lastLatencyMs=${this.lastLatency}
            .totalPreventedEth=${this.displayedPrevented}
            .mempoolDepth=${this.mempoolDepth}
            .liveTvls=${this.liveTvls}
          ></network-map>
          <div class="wdr-controls-row">
            ${this.renderControls()}
            ${this.renderPipeline()}
          </div>
          ${this.renderMetrics()}
          <div class="wdr-grid-2">
            ${this.renderFeed()}
            <div class="wdr-right-col">
              ${this.renderTimeline()}
              ${this.renderLegend()}
            </div>
          </div>
        </div>
      </div>
    `;
    }

    private renderLegend() {
        const items: Array<[string, string, string]> = [
            ["#666", "PENDING_TX", "mempool candidate"],
            ["#ff2244", "THREAT_*", "detection engine signal"],
            ["#36c88b", "DEFENSE_*", "pause / revert submitted + mined"],
            ["#c8ff00", "PROVER_*", "zk proof verification"],
            ["#00d9ff", "LEDGER_RECORDED", "on-chain counterfactual committed"],
            ["#d47d27", "PREEMPTIVE_*", "federation signature propagation"],
        ];
        return html`
      <div class="panel wdr-legend">
        <div class="panel-header">
          <span class="panel-label">EVENT LEGEND</span>
          <span class="panel-code">WIRE FORMAT</span>
        </div>
        <div class="wdr-legend__rows">
          ${items.map(
              ([c, k, d]) => html`
            <div class="wdr-legend__row">
              <span class="wdr-legend__dot" style="background:${c};box-shadow:0 0 8px ${c}66"></span>
              <span class="wdr-legend__k">${k}</span>
              <span class="wdr-legend__d">${d}</span>
            </div>
          `,
          )}
        </div>
        <div class="wdr-legend__footer">
          <button class="btn btn--ghost btn--sm" @click=${() => this.resetRun()} ?disabled=${this.running}>RESET RUN</button>
        </div>
      </div>
    `;
    }
}
