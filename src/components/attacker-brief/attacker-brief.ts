import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { api, ping } from "../../lib/api";
import "./attacker-brief.css";

type Tab = "briefing" | "setup" | "scenarios" | "rpc" | "launch";

interface Scenario {
    id: "blitz" | "recon" | "stealth";
    label: string;
    runtime: string;
    drama: string;
    profile: string;
    stages: string[];
    command: string;
    apiPath: string | null; // api-gateway demo route, null if Redis-only
}

const SCENARIOS: Scenario[] = [
    {
        id: "blitz",
        label: "OP-7741 · BLITZ",
        runtime: "~20 s",
        drama: "MAX",
        profile: "loud, textbook flash-loan oracle manipulation — every signal lights at once",
        stages: [
            "[1/4]  borrow 1,000,000 USDC  :: flash-loan (45 gwei)",
            "[2/4]  slam oracle reserves   :: swap (52 gwei, 47.3% deviation)",
            "[3/4]  drain victim pool      :: attack(address,uint256)",
            "[4/4]  repay loan             :: transfer",
        ],
        command: "REDIS_URL=redis://<defender-lan-ip>:6379 python3 demo/attacker.py blitz",
        apiPath: "/api/v1/demo/replay-scenario",
    },
    {
        id: "recon",
        label: "OP-3122 · RECON",
        runtime: "~40 s",
        drama: "PATIENT",
        profile: "intel-gathering sybil probes, small nudge swap, then the slam — 8-signal correlation",
        stages: [
            "[1/5]  sybil EOA probes       :: getReserves, balanceOf, approve × 7",
            "[2/5]  flash-loan borrow      :: 300k USDC, low gas",
            "[3/5]  nudge swap             :: 5% deviation (baseline shift)",
            "[4/5]  oracle slam            :: 41% deviation",
            "[5/5]  exploit + repay        :: attack(address,uint256)",
        ],
        command: "REDIS_URL=redis://<defender-lan-ip>:6379 python3 demo/attacker.py recon",
        apiPath: null,
    },
    {
        id: "stealth",
        label: "OP-9018 · STEALTH",
        runtime: "~10 s",
        drama: "SURGICAL",
        profile: "direct exploit — no flash loan, no oracle touch, no cover txs. Loses on signature alone",
        stages: ["[1/1]  attack(address,uint256) :: low gas, known selector"],
        command: "REDIS_URL=redis://<defender-lan-ip>:6379 python3 demo/attacker.py stealth",
        apiPath: null,
    },
];

const TARGETS: Array<{ key: string; note: string }> = [
    { key: "FlashLoanProvider", note: "flash-loan source — borrow/repay flow" },
    { key: "OraclePair", note: "price oracle — slam reserves to shift mark price" },
    { key: "VictimLendingPool", note: "final target — drain on shifted price" },
    { key: "FlashLoanAttacker", note: "attack contract — deployed with attack(address,uint256)" },
    { key: "ThreatRegistry", note: "defender signature ledger — read-only for attacker" },
    { key: "PauseController", note: "defender pause hook — what lands before your exploit mines" },
];

type Addrs = Record<string, string>;

@customElement("attacker-brief")
export class AttackerBrief extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private tab: Tab = "briefing";
    @state() private addresses: Addrs = {};
    @state() private gatewayUp: boolean | null = null;
    @state() private busy: Scenario["id"] | null = null;
    @state() private lastResult: { ok: boolean; msg: string } | null = null;
    @state() private copied = "";

    override async connectedCallback() {
        super.connectedCallback();
        this.gatewayUp = await ping();
        if (this.gatewayUp) {
            try {
                const base = (import.meta.env.VITE_SENTINEL_API as string) ?? "http://127.0.0.1:8080";
                const h = await fetch(`${base}/api/v1/addresses`);
                if (h.ok) this.addresses = (await h.json()) as Addrs;
            } catch {
                /* gateway call failed — fall through to static fallback */
            }
        }
        // Static fallback: read the checked-in addresses file. Works offline (air-gapped
        // demo rehearsal) and also masks a transient gateway outage so the briefing is
        // always fully populated with real deployed addresses.
        if (Object.keys(this.addresses).length === 0) {
            try {
                const res = await fetch("/config/addresses.local.json");
                if (res.ok) this.addresses = (await res.json()) as Addrs;
            } catch {
                /* leave empty — UI shows placeholder notice */
            }
        }
    }

    private setTab(t: Tab) {
        this.tab = t;
    }

    private async copy(text: string, key: string) {
        try {
            await navigator.clipboard.writeText(text);
            this.copied = key;
            window.setTimeout(() => {
                if (this.copied === key) this.copied = "";
            }, 1400);
        } catch {
            /* no clipboard */
        }
    }

    private async fireScenario(s: Scenario) {
        if (this.busy) return;
        this.busy = s.id;
        this.lastResult = null;
        try {
            if (s.id === "blitz") {
                const r = await api.replayScenario();
                this.lastResult = r.replayStarted
                    ? { ok: true, msg: `broadcast tx ${r.txHash ?? ""} — detection in T-80ms` }
                    : { ok: false, msg: r.error ?? "launch rejected" };
            } else {
                // For recon/stealth the api-gateway only exposes the replay route;
                // we can approximate with preemptive/inject for the UI demo.
                const r = s.id === "recon" ? await api.preemptive() : await api.injectInstruction();
                this.lastResult =
                    "submitted" in r && r.submitted
                        ? { ok: true, msg: `event ${("eventId" in r ? r.eventId : "").slice(0, 14)}… seeded` }
                        : "preemptive" in r && r.preemptive
                          ? { ok: true, msg: `event ${r.eventId.slice(0, 14)}… seeded · trigger ${r.triggerTx ?? "—"}` }
                          : { ok: false, msg: ("error" in r ? r.error : "launch rejected") ?? "launch rejected" };
            }
        } catch (err) {
            this.lastResult = { ok: false, msg: (err as Error).message };
        } finally {
            this.busy = null;
        }
    }

    // ── Renderers ──

    private renderHeader() {
        const live = this.gatewayUp === true;
        const color = live ? "#c8ff00" : this.gatewayUp === false ? "#d47d27" : "#666";
        const label = live
            ? "GATEWAY REACHABLE"
            : this.gatewayUp === false
              ? "GATEWAY DOWN — COMMANDS ONLY"
              : "PROBING…";
        return html`
      <div class="wr-header">
        <div class="wr-header__left">
          <a href="#/demo" class="wr-header__back" @click=${(e: Event) => {
              e.preventDefault();
              window.location.hash = "#/demo";
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </a>
          <div class="wr-header__title">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="9" cy="9" r="5" fill="none" stroke="#ff2244" stroke-width="1" opacity="0.5"/>
              <circle cx="9" cy="9" r="2" fill="#ff2244" opacity="0.9"/>
              <line x1="0" y1="9" x2="18" y2="9" stroke="#ff2244" stroke-width="1" opacity="0.7"/>
            </svg>
            <span class="wr-header__wordmark" style="color:#ff2244">ADVERSARY</span>
            <span class="wr-header__badge ab-badge--red">BRIEFING · CLASSIFIED</span>
          </div>
        </div>
        <div class="wr-status-bar">
          <div class="wr-status-item">
            <span class="status-dot" style="background:${color};box-shadow:0 0 10px ${color}66"></span>
            <span class="wr-status-label">GATEWAY</span>
            <span class="wr-status-value" style="color:${color}">${label}</span>
          </div>
          <div class="wr-status-item">
            <span class="wr-status-label">CHAIN</span>
            <span class="wr-status-value">ANVIL:8545</span>
          </div>
          <div class="wr-status-item">
            <span class="wr-status-label">ROLE</span>
            <span class="wr-status-value" style="color:#ff2244">ATTACKER EOA</span>
          </div>
        </div>
      </div>
    `;
    }

    private renderTabs() {
        const tabs: { key: Tab; label: string }[] = [
            { key: "briefing", label: "BRIEFING" },
            { key: "setup", label: "SETUP" },
            { key: "scenarios", label: "SCENARIOS" },
            { key: "rpc", label: "DIRECT RPC" },
            { key: "launch", label: "LAUNCH CONSOLE" },
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

    private codeBlock(code: string, key: string) {
        const copied = this.copied === key;
        return html`
      <div class="ab-code">
        <pre class="ab-code__pre"><code>${code}</code></pre>
        <button class="ab-code__copy" @click=${() => this.copy(code, key)}>
          ${copied ? "COPIED ✓" : "COPY"}
        </button>
      </div>
    `;
    }

    private renderBriefing() {
        return html`
      <div class="panel ab-brief">
        <div class="panel-header">
          <span class="panel-label">OPERATIONAL BRIEFING</span>
          <span class="panel-code">EYES ONLY · READ TOP TO BOTTOM</span>
        </div>
        <div class="ab-brief__body">
          <div class="ab-brief__section">
            <h3 class="ab-brief__h">1 · PREMISE</h3>
            <p>
              You are the attacker in a scripted adversary-vs-defender demo. The defender runs SENTINEL:
              mempool-monitor, detection-engine, counterfactual-sim, zk-prover, defense-agent. Your job is
              to run a textbook DeFi exploit against the victim lending pool on a local Anvil fork. Every
              tx you broadcast is seen by the defender's mempool subscriber before it mines.
            </p>
          </div>
          <div class="ab-brief__section">
            <h3 class="ab-brief__h">2 · OBJECTIVE</h3>
            <p>
              Drain <code class="ab-inline">VictimLendingPool</code> via a flash-loan oracle-manipulation
              exploit: borrow WETH, slam the <code class="ab-inline">OraclePair</code> reserves to shift
              the mark price, and drain the victim pool at the skewed rate — all within a single block.
            </p>
          </div>
          <div class="ab-brief__section">
            <h3 class="ab-brief__h">3 · GROUND TRUTH</h3>
            <ul class="ab-brief__list">
              <li>You <b style="color:#ff2244">will lose</b>. The pipeline is designed so detection fires at ≥0.85 confidence before your exploit tx mines.</li>
              <li>The defender auto-submits a <code class="ab-inline">pause()</code> tx at higher priority. Your call reverts.</li>
              <li>Every attempt is recorded in <code class="ab-inline">CounterfactualLedger</code> with a ZK proof of what was prevented.</li>
            </ul>
          </div>
          <div class="ab-brief__section">
            <h3 class="ab-brief__h">4 · ENVIRONMENT</h3>
            <div class="ab-brief__grid">
              <div><span class="ab-kv__k">CHAIN</span><span class="ab-kv__v">Anvil · localhost:8545</span></div>
              <div><span class="ab-kv__k">ATTACKER EOA</span><span class="ab-kv__v">Anvil account #5</span></div>
              <div><span class="ab-kv__k">ATTACKER KEY</span><span class="ab-kv__v">0x8b3a…dffba (env <code class="ab-inline">ATTACKER_KEY</code>)</span></div>
              <div><span class="ab-kv__k">MEMPOOL</span><span class="ab-kv__v">Redis · <code class="ab-inline">sentinel.mempool.pending</code></span></div>
              <div><span class="ab-kv__k">LOAN AMOUNT</span><span class="ab-kv__v">900 × 10¹⁸ wei (900 WETH)</span></div>
              <div><span class="ab-kv__k">TARGET BLOCK</span><span class="ab-kv__v">same block as submission</span></div>
            </div>
          </div>
          <div class="ab-brief__section">
            <h3 class="ab-brief__h">5 · ROUTES OF ATTACK</h3>
            <ol class="ab-brief__list">
              <li><b>Direct RPC</b> — you send the exploit tx yourself (see <a href="#" @click=${(e: Event) => {
                  e.preventDefault();
                  this.setTab("rpc");
              }}>DIRECT RPC</a>).</li>
              <li><b>Scripted scenario</b> — run one of the three pre-canned attacker scripts (see <a href="#" @click=${(
                  e: Event,
              ) => {
                  e.preventDefault();
                  this.setTab("scenarios");
              }}>SCENARIOS</a>).</li>
              <li><b>Launch console</b> — for stage demos: one-click trigger via the api-gateway demo endpoint (see <a href="#" @click=${(
                  e: Event,
              ) => {
                  e.preventDefault();
                  this.setTab("launch");
              }}>LAUNCH CONSOLE</a>).</li>
            </ol>
          </div>
          <div class="ab-brief__section ab-brief__section--warn">
            <h3 class="ab-brief__h ab-brief__h--warn">6 · DO NOT</h3>
            <ul class="ab-brief__list">
              <li>Run this against any network that is not local Anvil.</li>
              <li>Fund the attacker EOA with real assets. The private key is public, published in the repo.</li>
              <li>Expose <code class="ab-inline">redis-server</code> to the public internet — the attacker script assumes LAN trust.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    }

    private renderSetup() {
        return html`
      <div class="ab-grid-2">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-label">A · BOOT THE DEFENDER STACK</span>
            <span class="panel-code">ONE TIME, ON YOUR MACHINE</span>
          </div>
          <div class="ab-setup__body">
            <p class="ab-step">1. Start Anvil with the default mnemonic.</p>
            ${this.codeBlock("anvil --block-time 1", "cmd-anvil")}
            <p class="ab-step">2. Deploy the demo contracts from the repo root.</p>
            ${this.codeBlock("forge script contracts/script/DeployLocal.s.sol \\\n  --rpc-url http://127.0.0.1:8545 \\\n  --broadcast", "cmd-deploy")}
            <p class="ab-step">3. Bring up Redis + all SENTINEL services.</p>
            ${this.codeBlock("docker compose up -d redis postgres\npnpm -C services/api-gateway dev", "cmd-compose")}
            <p class="ab-step">4. Confirm the gateway is healthy.</p>
            ${this.codeBlock("curl -s http://127.0.0.1:8080/api/v1/health | jq", "cmd-health")}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span class="panel-label">B · ATTACKER HOST</span>
            <span class="panel-code">PYTHON 3.11+ · LAN REACHABLE</span>
          </div>
          <div class="ab-setup__body">
            <p class="ab-step">1. Install the attacker deps.</p>
            ${this.codeBlock("pip install -r demo/requirements.txt", "cmd-pip")}
            <p class="ab-step">2. Point at the defender's Redis. On the defender box: <code class="ab-inline">ifconfig en0</code>.</p>
            ${this.codeBlock("export REDIS_URL=redis://<defender-lan-ip>:6379", "cmd-redis-env")}
            <p class="ab-step">3. Smoke-test connectivity.</p>
            ${this.codeBlock("python3 -c \"import asyncio,redis.asyncio as r; asyncio.run(r.from_url('$REDIS_URL').ping())\"", "cmd-smoke")}
            <p class="ab-step">4. Launch the attacker menu.</p>
            ${this.codeBlock("python3 demo/attacker.py", "cmd-menu")}
          </div>
        </div>
      </div>
    `;
    }

    private renderScenarios() {
        return html`
      <div class="ab-scen-list">
        ${SCENARIOS.map(
            (s) => html`
          <div class="panel ab-scen">
            <div class="panel-header">
              <span class="panel-label">${s.label}</span>
              <span class="panel-code">${s.runtime} · ${s.drama}</span>
            </div>
            <div class="ab-scen__body">
              <p class="ab-scen__profile">${s.profile}</p>
              <div class="ab-scen__stages">
                ${s.stages.map((st) => html`<div class="ab-scen__stage">${st}</div>`)}
              </div>
              <div class="ab-scen__run">
                <div class="ab-scen__run-label">RUN FROM ATTACKER HOST</div>
                ${this.codeBlock(s.command, `scen-${s.id}`)}
              </div>
            </div>
          </div>
        `,
        )}
      </div>
    `;
    }

    private renderRpc() {
        const addr = (k: string) => this.addresses[k] ?? `<${k}>  // run: forge script DeployLocal.s.sol`;

        const castCommand = `cast send ${addr("FlashLoanAttacker")} \\
  "attack(address,uint256)" \\
  ${addr("FlashLoanProvider")} \\
  900000000000000000000 \\
  --rpc-url http://127.0.0.1:8545 \\
  --private-key $ATTACKER_KEY`;

        const curlCommand = `curl -X POST http://127.0.0.1:8080/api/v1/demo/replay-scenario \\
  -H 'content-type: application/json' -d '{}'`;

        return html`
      <div class="panel ab-rpc">
        <div class="panel-header">
          <span class="panel-label">DIRECT RPC PROCEDURE</span>
          <span class="panel-code">FOR OPERATORS WHO PREFER RAW CALLS</span>
        </div>
        <div class="ab-rpc__body">
          <div class="ab-rpc__section">
            <h3 class="ab-brief__h">1 · TARGETS</h3>
            <div class="ab-targets">
              ${TARGETS.map(
                  (t) => html`
                <div class="ab-target">
                  <div class="ab-target__k">${t.key}</div>
                  <div class="ab-target__addr">${this.addresses[t.key] ?? "0x— gateway not reachable —"}</div>
                  <div class="ab-target__note">${t.note}</div>
                </div>
              `,
              )}
            </div>
          </div>

          <div class="ab-rpc__section">
            <h3 class="ab-brief__h">2 · SET YOUR KEY</h3>
            <p class="ab-brief__p">Anvil account #5 is the pre-funded attacker. Every other component of the demo assumes this key.</p>
            ${this.codeBlock("export ATTACKER_KEY=0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", "cmd-key")}
          </div>

          <div class="ab-rpc__section">
            <h3 class="ab-brief__h">3 · FIRE THE EXPLOIT</h3>
            <p class="ab-brief__p">
              Calls <code class="ab-inline">FlashLoanAttacker.attack(address,uint256)</code> with the flash provider
              and a 900 WETH loan size. This is exactly what the scripted <span style="color:#c8ff00">blitz</span>
              scenario broadcasts on stage 3.
            </p>
            ${this.codeBlock(castCommand, "cmd-cast")}
          </div>

          <div class="ab-rpc__section">
            <h3 class="ab-brief__h">4 · OR VIA THE GATEWAY</h3>
            <p class="ab-brief__p">
              Identical effect, one HTTP call. The gateway signs and submits the tx for you using the configured
              attacker key, then broadcasts a trigger alert on <code class="ab-inline">sentinel.alerts</code>.
            </p>
            ${this.codeBlock(curlCommand, "cmd-curl")}
          </div>

          <div class="ab-rpc__section">
            <h3 class="ab-brief__h">5 · WATCH YOURSELF GET CAUGHT</h3>
            <p class="ab-brief__p">
              Open <a href="#/demo" @click=${(e: Event) => {
                  e.preventDefault();
                  window.location.hash = "#/demo";
              }}>#/demo</a>
              (war demo room) to see the defender's pipeline light up as your tx moves mempool → detection →
              defense → proof → ledger. Your tx will revert.
            </p>
          </div>
        </div>
      </div>
    `;
    }

    private renderLaunch() {
        const disabled = !this.gatewayUp;
        return html`
      <div class="panel ab-launch">
        <div class="panel-header">
          <span class="panel-label">LAUNCH CONSOLE</span>
          <span class="panel-code">${this.gatewayUp ? "GATEWAY REACHABLE · ARMED" : "GATEWAY UNREACHABLE · BOOT STACK FIRST"}</span>
        </div>
        <div class="ab-launch__warn">
          ⚠ These buttons hit <code>POST /api/v1/demo/*</code> on the running api-gateway. They are live triggers
          against the local chain. Every call produces a real tx on Anvil and real events on Redis.
        </div>
        <div class="ab-launch__grid">
          ${SCENARIOS.map(
              (s) => html`
            <button
              class="ab-launch__btn ${this.busy === s.id ? "ab-launch__btn--busy" : ""}"
              ?disabled=${disabled || this.busy !== null}
              @click=${() => this.fireScenario(s)}
            >
              <div class="ab-launch__btn-id">${s.label}</div>
              <div class="ab-launch__btn-profile">${s.profile}</div>
              <div class="ab-launch__btn-cta">${this.busy === s.id ? "FIRING…" : "EXECUTE ▶"}</div>
            </button>
          `,
          )}
        </div>
        ${
            this.lastResult
                ? html`
          <div class="ab-launch__result ${this.lastResult.ok ? "" : "ab-launch__result--err"}">
            <span class="ab-launch__result-k">${this.lastResult.ok ? "TX BROADCAST" : "REJECTED"}</span>
            <span class="ab-launch__result-v">${this.lastResult.msg}</span>
          </div>
        `
                : nothing
        }
        <div class="ab-launch__footer">
          <a class="btn btn--ghost btn--sm" href="#/demo" @click=${(e: Event) => {
              e.preventDefault();
              window.location.hash = "#/demo";
          }}>
            OPEN WAR DEMO ROOM →
          </a>
        </div>
      </div>
    `;
    }

    override render() {
        return html`
      <div class="war-room attacker-brief">
        ${this.renderHeader()}
        ${this.renderTabs()}
        <div class="wr-content ab-content">
          ${this.tab === "briefing" ? this.renderBriefing() : ""}
          ${this.tab === "setup" ? this.renderSetup() : ""}
          ${this.tab === "scenarios" ? this.renderScenarios() : ""}
          ${this.tab === "rpc" ? this.renderRpc() : ""}
          ${this.tab === "launch" ? this.renderLaunch() : ""}
        </div>
      </div>
    `;
    }
}
