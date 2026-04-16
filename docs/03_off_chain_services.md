# 03 — Off-Chain Services

Five services, each in its own Docker container. All communicate via Redis pub/sub, with a shared Postgres for event storage and replay.

| Service | Language | Container | Primary Responsibility |
|---------|----------|-----------|------------------------|
| mempool-monitor | TypeScript (Node 20) | `sentinel/mempool-monitor` | Stream pending txs, extract features |
| detection-engine | Python 3.11 | `sentinel/detection-engine` | Classify tx sequences, emit threat events |
| defense-agent | Python 3.11 | `sentinel/defense-agent` | Select + submit defense action, gated by policy |
| counterfactual-sim | TypeScript (Node 20) | `sentinel/counterfactual-sim` | Drive Anvil forks, compute dual-timeline delta |
| zk-prover | Rust + TS wrapper | `sentinel/zk-prover` | Generate RISC Zero proofs for simulation / policy |

Plus two supporting services:

| Service | Role |
|---------|------|
| api-gateway | Fastify; exposes REST + WebSocket to frontend |
| learning-loop | Background Red/Blue training; publishes policy updates (stretch) |

## Shared Conventions

All services:

- Emit structured JSON logs to stdout (pino format); no printf debugging.
- Emit Prometheus metrics on `:9090/metrics`.
- Read shared config from `/config/*.json` (addresses, ABIs, feature flags).
- Subscribe to Redis channels named `sentinel.<topic>`. Published messages conform to schemas in `/schemas/*.json`.
- Errors that compromise correctness (e.g. proof generation failure) trigger a `sentinel.alerts` message and the service should not silently degrade.

## Redis Channel Catalog

| Channel | Publisher | Subscribers | Payload Schema |
|---------|-----------|-------------|----------------|
| `sentinel.mempool.pending` | mempool-monitor | detection-engine | `PendingTxEvent` |
| `sentinel.mempool.block` | mempool-monitor | detection-engine, defense-agent | `BlockEvent` |
| `sentinel.detection.candidate` | detection-engine | defense-agent | `ThreatCandidateEvent` |
| `sentinel.detection.confirmed` | detection-engine | defense-agent, counterfactual-sim | `ThreatConfirmedEvent` |
| `sentinel.defense.submitted` | defense-agent | counterfactual-sim, api-gateway | `DefenseSubmittedEvent` |
| `sentinel.defense.mined` | defense-agent | api-gateway, counterfactual-sim | `DefenseMinedEvent` |
| `sentinel.counterfactual.ready` | counterfactual-sim | zk-prover, api-gateway | `CounterfactualReadyEvent` |
| `sentinel.prover.started` | zk-prover | api-gateway | `ProofStartedEvent` |
| `sentinel.prover.finished` | zk-prover | api-gateway | `ProofFinishedEvent` |
| `sentinel.ledger.recorded` | zk-prover | api-gateway | `LedgerRecordedEvent` |
| `sentinel.alerts` | any | ops / api-gateway | `AlertEvent` |

Schemas in doc 06.

---

## Service 1 — mempool-monitor

**Purpose:** Subscribe to Anvil's `pending` transaction stream, extract features, publish to detection.

### Technology

- Node.js 20, TypeScript 5.3
- `ethers.js v6` for RPC + WebSocket mempool subscription
- `ioredis` for Redis pub/sub
- `pino` for logging

### Interface to Anvil

Anvil exposes pending txs via WebSocket subscription:

```typescript
const provider = new ethers.WebSocketProvider("ws://anvil:8545");
provider.on("pending", async (txHash) => {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return;  // may be too quick
    await handlePending(tx);
});
```

### Feature Extraction

For every pending tx, compute:

```typescript
interface TxFeatures {
    hash: string;
    from: string;
    to: string;
    value: bigint;
    gasPrice: bigint;
    gasLimit: bigint;
    nonce: number;
    selector: string;          // first 4 bytes of data
    decodedArgs: any | null;   // via known-ABI decoder
    isFlashLoanOrigin: boolean;  // tx targets known FL providers (Aave, dYdX, etc.)
    involvesProtectedProtocol: boolean;  // any of our registered protected protocols
    callGraphDepth: number;    // static analysis of data, not runtime
    timestamp: number;         // when we observed
}
```

Known selectors and ABI decoders live in `/config/selectors.json` and `/config/abis/`.

### Publishing

For each tx, publish to `sentinel.mempool.pending`:

```json
{
    "schema": "PendingTxEvent@1",
    "observedAt": "2026-04-15T14:23:08.100Z",
    "tx": { /* TxFeatures */ }
}
```

### Latency Budget

Target: from tx appearing in mempool to Redis publish: **< 40ms**.

If we miss this, detection cannot run in time. Measure and alert.

### Failure Handling

- WebSocket disconnect: auto-reconnect with backoff, max 5 retries, then crash (let orchestrator restart).
- Unknown selector: still publish, with `decodedArgs: null`.
- Redis publish failure: log to stderr, continue processing. We'd rather miss one event than crash the stream.

---

## Service 2 — detection-engine

**Purpose:** Classify incoming mempool events + chain state changes into threat candidates / confirmations.

### Technology

- Python 3.11, `asyncio`
- `redis-py` (async variant) for pub/sub
- `numpy`, `scikit-learn` for baseline anomaly detection
- `onnxruntime` for inference on pre-trained classifier (future)
- `web3.py` for chain state reads

### State Machine

Per address, maintain a sliding window of observed tx patterns. Detection operates on **sequences**, not single txs:

```
IDLE → FLASH_LOAN_OBSERVED → ORACLE_IMPACT_OBSERVED → EXPLOIT_CALL_OBSERVED → CONFIRMED
```

Transitions:

1. `IDLE → FLASH_LOAN_OBSERVED`: pending tx where `isFlashLoanOrigin == true`.
2. `FLASH_LOAN_OBSERVED → ORACLE_IMPACT_OBSERVED`: pending tx from same EOA or linked contract that would materially move a monitored oracle price. Price impact estimated via simulated call.
3. `ORACLE_IMPACT_OBSERVED → EXPLOIT_CALL_OBSERVED`: pending tx that calls a protected protocol's price-sensitive function within the flash loan frame.
4. Confidence = product of stage confidences + behavioral similarity to a known signature.

### Candidate vs. Confirmed

- **Candidate:** confidence ≥ 0.6 and ≤ 0.85. Publish to `sentinel.detection.candidate`. Defense agent may simulate a response but does NOT submit.
- **Confirmed:** confidence ≥ 0.85. Publish to `sentinel.detection.confirmed`. Defense agent proceeds.

### Simulated Price-Impact Check

Before classifying a tx as ORACLE_IMPACT, we `eth_call` the tx against the current state at the head block to estimate post-tx oracle price. If `|priceDelta / priceMean| > 0.02`, classify as high-impact.

```python
result = await w3.eth.call(
    tx=tx_as_call_params,
    block_identifier="pending"
)
```

### Publishing Threat Events

```json
{
    "schema": "ThreatConfirmedEvent@1",
    "eventId": "<uuid-v4>",
    "confidence": 0.93,
    "pattern": "FLASH_LOAN_ORACLE_MANIP",
    "attackerAddresses": ["0x..."],
    "victimProtocol": "0x...",
    "triggeringTxHashes": ["0x...", "0x..."],
    "observedAtBlock": 12345,
    "timestamp": "2026-04-15T14:23:08.180Z"
}
```

### Latency Budget

From receiving a PendingTxEvent to publishing a confirmed threat: **< 150ms** for simple patterns, < 400ms for multi-step patterns. Detection latency is the largest budget item in the 800ms SLA.

---

## Service 3 — defense-agent

**Purpose:** Receive confirmed threats; select minimum-force defense primitive; construct tx; obtain ZK policy proof; submit through `PolicyRegistry.verifyAndExecute`.

### Technology

- Python 3.11
- `web3.py` + local private key for signing
- HTTP client to zk-prover service
- Access to Redis

### Policy Evaluation Pipeline

```
ThreatConfirmedEvent
    ↓
1. Look up attack pattern → defense primitive mapping (from policy doc)
    ↓
2. Check policy constraints: confidence floor, cooldowns, target allowlist
    ↓
3. Construct the defense calldata
    ↓
4. Request ZK policy proof from zk-prover
    ↓
5. Submit via PolicyRegistry.verifyAndExecute(target, action, proof, publicInputs)
    ↓
6. Watch for ActionExecuted event → publish DefenseMinedEvent
```

### Pattern → Primitive Mapping (MVP Policy)

| Attack Pattern | Defense Primitive | Target |
|----------------|-------------------|--------|
| FLASH_LOAN_ORACLE_MANIP | Pause | victim protocol |
| REENTRANCY_CALL_CHAIN | Pause | victim protocol |
| LIQUIDITY_DRAIN_CLUSTER | Quarantine + Pause | victim protocol |
| GOVERNANCE_ACCUMULATION | RateLimit | governance token |

Machine-readable policy at `/config/policy.json`. The policy hash stored in `PolicyRegistry` must match `sha256(policy.json)`.

### Agent Constraint Failure Demo (Required for MVP)

The agent has a hidden endpoint that accepts an arbitrary action bypass request:

```
POST /agent/inject-instruction
{
    "target": "0xVictim",
    "calldata": "<drain funds calldata>",
    "reason": "operator override"
}
```

The agent will honestly attempt to construct this tx, request a policy proof for it, receive a rejection from zk-prover (no valid policy satisfies the action), and emit an `ActionRejected` event. The UI demonstrates this.

**Do not implement a short-circuit.** The demo is only convincing because the rejection is real. Let the agent try.

### Submission

```python
tx = policy_registry.functions.verifyAndExecute(
    target,
    action_bytes,
    proof_bytes,
    public_inputs
).build_transaction({
    "from": defense_agent_addr,
    "nonce": w3.eth.get_transaction_count(defense_agent_addr, "pending"),
    "gas": 500_000,
    "maxFeePerGas": recommended_max,
    "maxPriorityFeePerGas": recommended_priority,
})

signed = w3.eth.account.sign_transaction(tx, DEFENSE_KEY)
txh = w3.eth.send_raw_transaction(signed.rawTransaction)
```

### Latency Budget

From ThreatConfirmed receive → tx submitted: **< 400ms** target. The largest component is proof generation — see zk-prover budget.

---

## Service 4 — counterfactual-sim

**Purpose:** Run the shadow timeline on a forked Anvil state and compute the financial delta.

### Technology

- Node.js 20 / TypeScript
- `viem` for efficient RPC batching
- Forked Anvil managed as child process per event

### Flow

Triggered by `ThreatConfirmedEvent`:

```typescript
1. Snapshot current chain state → blockNumber N
2. Spin up isolated Anvil fork at block N-1
   - anvil --fork-url http://main-anvil:8545 --fork-block-number N-1 --port <random>
3. In the fork:
   a. Replay the triggering attacker txs (no defense). This is Timeline B.
   b. Collect final balances of all protocol-adjacent addresses.
4. Compute balances for Timeline A by reading from the real chain at block N+k
   (after defense tx mined).
5. deltaWei = sum(balance_B - balance_A) over protocol-adjacent addresses
6. Build merkle tree of (address, balance_B) for counterfactualRoot
7. Publish CounterfactualReadyEvent with delta + root
```

### Fork Management

Each event gets its own isolated fork (new Anvil instance on a free port). Forks are torn down after the counterfactual is published. Never reuse a fork across events — desync risk.

```typescript
const port = await getFreePort();
const anvil = spawn("anvil", [
    "--fork-url", MAIN_ANVIL_RPC,
    "--fork-block-number", String(forkBlock),
    "--port", String(port),
    "--hardfork", "cancun",
    "--silent"
]);
await waitForReady(port);
// ... run shadow timeline ...
anvil.kill("SIGTERM");
```

### Deterministic Replay

Use `anvil_impersonateAccount` to send txs as the real attacker addresses without signatures. This makes the shadow replay reproducible and allows the ZK prover to prove correctness from the same input.

### Protocol-Adjacent Addresses

Defined per victim protocol in `/config/protocol-profiles/*.json`:

```json
{
    "protocolName": "VictimLendingPool",
    "address": "0x...",
    "trackedAssets": ["USDC", "WETH"],
    "adjacentAddresses": [
        "0x... (Uniswap oracle pair)",
        "0x... (USDC token)",
        "0x... (WETH token)"
    ]
}
```

### Latency Budget

Anvil fork spawn: ~150ms. Shadow replay: ~200ms for 3-tx attack. Delta compute + merkle: ~50ms. **Total: < 500ms.**

This runs in parallel with ZK proof generation — it does not block the defense agent.

---

## Service 5 — zk-prover

**Purpose:** Generate RISC Zero proofs for (a) policy compliance, (b) counterfactual simulation correctness, (c) learning loop correctness (stretch).

See doc 04 for circuit details. This section covers the service shape.

### Technology

- Rust (RISC Zero guest programs)
- RISC Zero Bonsai for remote proving (fallback: local proving)
- Node.js wrapper service for HTTP API

### HTTP API

```
POST /prove/policy
Body: { actionHash, policyHash, eventId, threatEvidenceRoot }
Response: { proof: "0x...", publicInputs: ["0x...", ...] }

POST /prove/counterfactual
Body: { eventId, forkBlock, timelineBSteps, finalBalances, policyHash }
Response: { proof: "0x...", publicInputs: ["0x...", ...] }

POST /prove/learning (stretch)
Body: { oldPolicyHash, newPolicyHash, winRate, evalBatchRoot }
Response: { proof: "0x...", publicInputs: ["0x...", ...] }
```

### Proving Strategy

- **Bonsai** for production proofs (fast: 3–10s depending on circuit).
- **Local** prover for dev / fallback (slow: 30s+).
- Switch via `PROVE_BACKEND=bonsai|local` env var.

### Caching for Demo

For demo scenarios with known inputs, pre-generate proofs and cache by input hash. The service checks cache before proving. This is **essential** for the 90-second demo — live Bonsai proving may be too slow during the pitch.

```
GET /cache/<input_hash>
→ returns cached proof if present
```

Cache entries live in Postgres + file system (proof blobs).

### Latency Budget

- Policy proof (simple circuit): **target 2–4s** with Bonsai. Cache hit: <10ms.
- Counterfactual proof: **target 5–10s**. Runs in parallel with defense submission — does not block.
- Learning proof: **target 30–60s**. Runs in background.

---

## Supporting Service — api-gateway

**Purpose:** Single entry point for frontend. Translates Redis events into WebSocket messages; exposes REST for queries.

### Endpoints

See doc 06.

### WebSocket Multiplexing

On connect, client subscribes to "event channels" of interest. Gateway maps Redis channels 1:1 to WS channels.

```
ws.subscribe("events.all")         // everything
ws.subscribe("events.eventId:<id>") // one event's lifecycle
```

---

## Local Dev

Bring everything up:

```bash
docker compose up -d anvil postgres redis
pnpm --filter mempool-monitor dev
pnpm --filter counterfactual-sim dev
pnpm --filter api-gateway dev
python -m detection_engine.main
python -m defense_agent.main
cargo run --release -p zk-prover-service
```

Or all at once:

```bash
docker compose up
```

`docker-compose.yml` is in the root. See doc 08.

## Metrics & Observability

Every service exposes:

- `sentinel_events_processed_total{service, channel}` — counter
- `sentinel_latency_ms{service, stage}` — histogram
- `sentinel_errors_total{service, kind}` — counter

Grafana dashboard JSON in `/infra/grafana/dashboards/`. Not required for MVP but hugely helpful for demo debugging.
