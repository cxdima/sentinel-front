# 07 — Frontend & Visualization Suite

The frontend is the deliverable that makes or breaks the demo. It is NOT a dashboard — it is a choreographed narrative experience. Every component exists to produce a specific reaction in the judge watching.

## Stack

- **React 18** + **TypeScript 5.3**
- **Vite** as build tool
- **TailwindCSS** for styling (no UI lib; keep it custom and precise)
- **D3 v7** for graph layouts and force simulations
- **Framer Motion** for transitions and choreographed sequences
- **zustand** for global state
- **viem** for chain reads (read-only wallet, no signer)
- Native `WebSocket` for event stream

## Page Layout

Single-page app. Three routes:

- `/` — Mission Control (home) — overview, recent events, live state
- `/event/:eventId` — Event Detail — full drill-down on one threat event
- `/demo` — Demo Mode — minimal chrome, full-screen visualizations, choreographed

## Component Tree

```
<App>
├── <NavBar/>
└── <Routes>
    ├── "/" → <MissionControl>
    │   ├── <LiveStatusBar/>
    │   ├── <EventFeed/>
    │   ├── <RecentDeltaSummary/>
    │   └── <ImmunityMap/>
    │
    ├── "/event/:id" → <EventDetail>
    │   ├── <TrustInterface/>
    │   ├── <AttackIntelGraph/>
    │   ├── <DualTimelineViewer/>
    │   ├── <ProofViewer/>
    │   └── <EventTimeline/>
    │
    └── "/demo" → <DemoMode>
        └── <DemoOrchestrator>         # drives the others based on scenario
            ├── <AttackIntelGraph/>    # fullscreen mode
            ├── <TrustInterface/>      # fullscreen mode
            ├── <DualTimelineViewer/>
            ├── <BattlefieldViz/>
            ├── <TimeScrollAudit/>
            └── <ImmunityMap/>
```

## State Architecture

Single `zustand` store, partitioned:

```typescript
interface SentinelState {
    // Connection
    wsStatus: "connecting" | "open" | "closed";
    subscriptions: Set<string>;

    // Events
    events: Map<string, EventRecord>;   // by eventId
    eventOrder: string[];                // by recency
    currentEventId: string | null;

    // Ledger
    ledgerEntries: LedgerEntry[];
    totalDeltaWei: bigint;

    // Trust sequence (driven by api-gateway cues)
    trustState: {
        eventId: string | null;
        phase: "idle" | "ambiguity" | "suspicion" | "proof" | "resolved";
        underlyingTxHash: string | null;
        proofVerified: boolean;
    };

    // Battlefield (Red/Blue viz)
    battlefield: {
        generation: number;
        redNodes: RedNode[];
        blueNodes: BlueNode[];
        attempts: Attempt[];
        winRate: number;
    };

    // Immunity
    immunityMap: {
        nodes: ProtocolNode[];
        lastPropagationId: string | null;
    };

    // Actions
    connect: () => void;
    subscribe: (channel: string) => void;
    handleMessage: (msg: WsMessage) => void;
}
```

Side effects (fetching REST data, driving WS subscription) live in React Query hooks; state mutations live in zustand actions.

## Component Spec — `<TrustInterface>`

The single most important component in the app. Implements the Trust Collapse Sequence.

### Visual Language

- Background: near-black (#08090d) with subtle grid texture
- Text: monospace for technical data, sans-serif for narrative
- Accent color shifts with phase:
  - Ambiguity: neutral gray (#7a7d87)
  - Suspicion: warning amber (#d47d27)
  - Proof: validation green (#36c88b)
  - Resolved: bright cyan (#00d9ff)

### Phases

**Phase 1 — Ambiguity**
Displays:
```
Contract paused at block #12345.

Should you trust this?
```

Two subtly-animated buttons: "Verify action" | "Dismiss". The "Verify action" button is the narrative hook — the user clicks it, and the Trust Collapse begins. (In demo mode, auto-clicks on cue.)

**Phase 2 — Suspicion**
Displays an inset box labeled "Worst case":
```
What if this was a false positive?
What if the operator is draining funds?
What if no one can verify this?
```
Followed by:
```
Checking policy constraint...
Checking action bounds...
Querying on-chain verifier...
```
Each line appears with a ~300ms cascade. The queries are REAL — each triggers a `viem` call to `PolicyRegistry.currentPolicyHash()`, `PolicyVerifier.verify(proof, publicInputs)`, `CounterfactualLedger.getEntry(eventId)`. Results stream in.

**Phase 3 — Proof Injection**
When verifier call returns `true`:
```
ACTION VALID
POLICY CONSTRAINT SATISFIED
PROOF VERIFIED ON-CHAIN
```
Appears in green, with a subtle scale/fade animation (150ms).

**Phase 4 — Resolved**
Full interface shows:
```
EVENT 0x7a3f...
Block #12345 | Defense primitive: PAUSE
Policy hash: 0xabcd... matches on-chain
Proof digest: 0xef12... verified
Counterfactual delta: $2,400,000 prevented
```

### Key Implementation Note

**Do not fake the verifier call.** The reason the sequence is convincing is that it really queries the chain. If the judges open devtools they'll see real `eth_call` traffic to the local Anvil instance.

## Component Spec — `<AttackIntelGraph>`

Force-directed graph showing the structure of a live attack.

### Data Model

```typescript
interface AttackGraphData {
    nodes: Array<{
        id: string;           // address
        type: "attacker" | "flashloan" | "oracle" | "victim" | "token";
        label: string;
        value?: bigint;       // balance/flow value
    }>;
    edges: Array<{
        id: string;
        source: string;       // node id
        target: string;
        kind: "transfer" | "call" | "approve" | "borrow" | "deposit";
        valueWei?: bigint;
        intent?: string;      // semantic annotation: "flash-loan-init", "drain-sequence", etc.
    }>;
}
```

### Visual

- D3 `forceSimulation` with `forceLink`, `forceManyBody`, `forceCenter`.
- Node radius scales with log(value).
- Edge animation: particles flow along the path, colored by intent.
- On intent change (e.g. "flash loan init" → "liquidity manipulation"), a label fades into view near the edge.

### Source of Truth

Backend emits `attack-intel.update` WS messages. Each update is a graph diff (add/remove node, add/remove edge, update edge intent). Frontend applies diff.

For MVP, the graph is driven by pre-computed updates tied to the demo scenario timeline.

## Component Spec — `<DualTimelineViewer>`

The WITH/WITHOUT split screen.

### Layout

Horizontal split, 50/50. Top panel: "WITH SENTINEL" (Timeline A). Bottom: "WITHOUT SENTINEL" (Timeline B).

Each panel shows:
- Chain state summary (block #, victim pool balance, attacker balance)
- Transaction list with per-tx status (confirmed / reverted / would-have-completed)
- Large delta indicator: Timeline A shows "$0 stolen"; Timeline B shows "-$2,400,000"

### Scrub Bar

At the bottom, a timeline scrubber. Dragging it moves both panels backward/forward through block history. The delta figure updates dynamically.

For MVP, scrubbing operates on pre-indexed data (we snapshot balances at key blocks and interpolate).

## Component Spec — `<BattlefieldViz>`

Red/Blue adversarial loop visualization.

### Visual

- Two columns of nodes: Red (left) vs Blue (right)
- Lines between them represent attack attempts
- Color of line: red (success), orange (partial), green (blocked)
- Generation counter at top
- Progress log panel: "Generation 42: Red found exploit in oracle dependency. Blue patched. Generation 43: Red tried chained reentrancy. Blue blocked."

### Animation

Every few seconds, a new attempt fires. Line traces from Red to Blue. Collides, blocks, or passes through. Log entry appears.

For MVP: prerecorded loop of ~60 generations, 30s cycle, loops cleanly.

## Component Spec — `<ImmunityMap>`

Network of subscribed protocols.

### Visual

- Circular arrangement of protocol logos (12 in MVP: Aave, Compound, Uniswap, etc.)
- Connections form a mesh network
- When a new signature publishes, origin node pulses; signal propagates outward in ~2s animation
- Each receiving node briefly glows, then its "immunity count" ticks up

### Source

`ws://immunity.propagation` tick messages. MVP: triggered by demo scenario; real impl uses `ThreatRegistry.SignaturePublished` events from chain.

## Component Spec — `<TimeScrollAudit>`

The block-by-block history inspector.

### Visual

Horizontal timeline showing blocks. Blocks with SENTINEL events are highlighted (red = attack detected, green = defense, purple = counterfactual recorded, blue = policy updated).

### Toggle

A prominent WITH / WITHOUT SENTINEL toggle in the header. Switching it re-renders the panel below with the alternate-history state. Numerically visible effect: "Protected capital: $12.4M (WITH)" vs "Protected capital: $2.1M (WITHOUT)".

### Tooltip Per Block

On hover, show:
- Block number + timestamp
- List of events at that block
- Link to event detail page

## Component Spec — `<ProofViewer>`

A utility component displayed in event detail pages.

Shows:
- Proof bytes (truncated, expandable)
- Public inputs
- Verifier contract address + method
- "Verify now" button — actually calls the on-chain verifier and displays the result
- Image ID of the circuit

## Demo Orchestrator

`<DemoOrchestrator>` owns the demo scenario timeline. Reads from `/config/demo-scenarios/flash-loan-oracle.json`:

```json
{
    "name": "Flash Loan Oracle Manipulation",
    "steps": [
        { "at": 0,    "action": "attack-begin" },
        { "at": 2000, "action": "defense-trigger" },
        { "at": 3000, "action": "timeline-diverge" },
        { "at": 5000, "action": "counterfactual-reveal" },
        { "at": 8000, "action": "ledger-commit" },
        { "at": 12000, "action": "immunity-propagate" }
    ]
}
```

The orchestrator fires each action at its scheduled time, triggering backend replays (via `POST /demo/replay-scenario`) and UI transitions.

## Dev Commands

```bash
pnpm --filter frontend dev        # localhost:3000, HMR
pnpm --filter frontend build
pnpm --filter frontend preview
```

## Performance Budget

- First meaningful paint: < 1.5s on local
- Graph render with 30 nodes: 60fps
- WS message handling: < 2ms p99 (measured; log if exceeded)

## Accessibility (nice to have)

Color-coded states also carry icon + text labels. Don't rely on color alone. Keyboard nav works in demo mode (spacebar advances scenario).

## Demo-Safe Mode

Env var `SENTINEL_DEMO_SAFE=true`:
- Disables live animation of expensive components during the narration phase (frees up CPU).
- Reduces graph node count to ≤ 20.
- Caches WS messages and replays them deterministically for repeatability.

Use this for the actual judging.

---

## Required Log Events for Visualization

Every backend service must emit structured log events on Redis pub/sub so the frontend components have data to render. This section is the contract between services and the UI — if a service doesn't emit these, the corresponding visualization breaks.

### Log Format (all services)

All log events published to Redis must follow this envelope:

```typescript
interface SentinelLogEvent {
    eventId: string;         // UUID, stable across the lifetime of one attack event
    service: string;         // "mempool-monitor" | "detection-engine" | "defense-agent" | "counterfactual-sim" | "zk-prover"
    type: string;            // event type (see per-service list below)
    ts: number;              // Unix ms (Date.now())
    payload: Record<string, unknown>;
}
```

Publish to Redis channel: `sentinel:events` (all consumers subscribe here). The api-gateway fans these out over the WebSocket stream to connected frontends.

---

### `mempool-monitor` — required events

| `type` | Payload fields | Consumed by |
|--------|---------------|-------------|
| `tx.pending` | `txHash`, `from`, `to`, `value`, `inputSig` (4-byte selector) | `<AttackIntelGraph>` (adds attacker node + edge) |
| `tx.suspicious` | `txHash`, `reason`, `confidenceEstimate` | `<EventFeed>`, `<TrustInterface>` (phase: ambiguity) |
| `tx.dropped` | `txHash` | `<AttackIntelGraph>` (remove node) |

---

### `detection-engine` — required events

| `type` | Payload fields | Consumed by |
|--------|---------------|-------------|
| `detection.pattern-match` | `eventId`, `pattern`, `confidence`, `matchedTxHashes[]` | `<AttackIntelGraph>` (annotate edges with intent), `<EventFeed>` |
| `detection.confirmed` | `eventId`, `pattern`, `confidence`, `blockNumber` | `<TrustInterface>` (phase: suspicion → triggers queries), `<TimeScrollAudit>` (red block marker) |
| `detection.false-positive` | `eventId`, `reason` | `<TrustInterface>` (abort trust sequence), `<EventFeed>` |

---

### `defense-agent` — required events

| `type` | Payload fields | Consumed by |
|--------|---------------|-------------|
| `defense.action-proposed` | `eventId`, `actionType` (`pause`/`quarantine`/`drain-halt`), `targetContract` | `<TrustInterface>` (phase: proof — starts verifier queries) |
| `defense.proof-requested` | `eventId`, `circuitId`, `publicInputsHash` | `<ProofViewer>` (populates circuit + inputs) |
| `defense.tx-submitted` | `eventId`, `txHash`, `blockNumber` | `<TimeScrollAudit>` (green block marker), `<DualTimelineViewer>` (Timeline A: defense tx appears) |
| `defense.tx-confirmed` | `eventId`, `txHash`, `gasUsed`, `blockNumber` | `<TrustInterface>` (phase: resolved), `<LiveStatusBar>` |
| `defense.policy-rejected` | `eventId`, `reason` | `<TrustInterface>` (Agent Constraint Failure branch) |

---

### `counterfactual-sim` — required events

| `type` | Payload fields | Consumed by |
|--------|---------------|-------------|
| `sim.fork-started` | `eventId`, `forkBlock`, `forkId` | `<DualTimelineViewer>` (Timeline B: fork begins) |
| `sim.tx-replayed` | `eventId`, `forkId`, `txHash`, `status` (`success`/`reverted`), `balanceDelta` | `<DualTimelineViewer>` (Timeline B: tx appears) |
| `sim.delta-computed` | `eventId`, `deltaWei`, `deltaUSD`, `victimBalanceReal`, `victimBalanceShadow` | `<DualTimelineViewer>` (delta figure), `<RecentDeltaSummary>` |
| `sim.ledger-committed` | `eventId`, `ledgerTxHash`, `deltaWei`, `proofDigest` | `<TimeScrollAudit>` (purple block marker), `<EventDetail>` |

---

### `zk-prover` — required events

| `type` | Payload fields | Consumed by |
|--------|---------------|-------------|
| `proof.generating` | `eventId`, `circuitId`, `backend` (`local`/`bonsai`) | `<ProofViewer>` (spinner) |
| `proof.complete` | `eventId`, `circuitId`, `proofBytes` (hex), `publicInputs`, `imageId`, `provingTimeMs` | `<ProofViewer>` (full proof display), `<TrustInterface>` (proof injected) |
| `proof.failed` | `eventId`, `circuitId`, `reason` | `<TrustInterface>` (Agent Constraint Failure — expected path for malicious instruction demo) |

---

### Immunity propagation — required events (emitted by api-gateway after ledger commit)

| `type` | Payload fields | Consumed by |
|--------|---------------|-------------|
| `immunity.propagation` | `eventId`, `signatureHash`, `subscriberAddresses[]`, `propagationMs` | `<ImmunityMap>` (pulse + propagation animation) |

---

### Battlefield / Red-Blue loop (MVP: pre-recorded, Phase 3+: live)

For MVP, the `<BattlefieldViz>` component reads a static JSON feed. Format:

```typescript
interface BattlefieldTick {
    generation: number;
    attempt: {
        redStrategy: string;       // e.g. "chained-reentrancy"
        outcome: "blocked" | "partial" | "succeeded";
        blueCounter: string | null;
    };
    winRate: number;               // Blue win rate, 0–1
    logLine: string;               // Human-readable for progress log panel
}
```

Pre-recorded ticks live at `/config/battlefield-prerecorded.json`. When Phase 3 is live, the detection-engine emits `battlefield.tick` events on Redis using the same shape.

---

### Log Monitoring for Debug

During development, tail all visualization-relevant events with:

```bash
redis-cli subscribe sentinel:events
```

If a visualization component is blank during a demo run, the first debug step is confirming the expected event type is appearing in this stream with the correct `eventId`.

Performance note: the frontend's `handleMessage` action in zustand must process each event in < 2ms. If an event payload is large (e.g. `proofBytes`), truncate to first 256 bytes for display; store the full value in the event store and lazy-load on expand.
