# 06 — API Specifications

Two surfaces:

1. **REST API** — for queries, pre-fetch, and diagnostics. Served by api-gateway on port 8080.
2. **WebSocket API** — for live event streams. Served by api-gateway on port 8081 (or upgrade at `/ws`).

All requests/responses are JSON. All timestamps are ISO 8601 UTC. All bytes are 0x-prefixed hex.

## Authentication

MVP: no auth. Gateway binds to localhost only.

Production: Bearer JWT, issued by `/auth/token` using signed message from operator key. Out of MVP scope.

---

## REST API

Base URL: `http://localhost:8080/api/v1`

### Health

```
GET /health
200: { "status": "ok", "services": { "mempool": "up", "detection": "up", ... }, "blockHeight": 123 }
```

Returns 503 if any critical service is down.

### Events

```
GET /events?limit=50&cursor=<eventId>
200: {
    "events": [EventRecord],
    "nextCursor": "<eventId>"
}
```

`EventRecord`:
```json
{
    "eventId": "0x...",
    "kind": "THREAT" | "DEFENSE" | "REJECTION" | "COUNTERFACTUAL" | "SIGNATURE",
    "status": "detected" | "defended" | "rejected" | "recorded",
    "pattern": "FLASH_LOAN_ORACLE_MANIP",
    "victimProtocol": "0x...",
    "blockNumber": 12345,
    "timestamp": "2026-04-15T14:23:08.180Z",
    "confidence": 0.93,
    "defenseActionHash": "0x..." | null,
    "counterfactualEntry": LedgerEntry | null
}
```

### Event Detail

```
GET /events/:eventId
200: FullEventRecord (includes sub-events: mempool observations, proof references, tx hashes)
404: event not found
```

### Ledger

```
GET /ledger?limit=50&cursor=<entryId>
200: {
    "entries": [LedgerEntry],
    "totalDeltaWei": "123456789000000000000",
    "totalEntryCount": 42
}
```

`LedgerEntry`:
```json
{
    "eventId": "0x...",
    "atBlock": 12345,
    "deltaWei": "10000000000000000000000",   // BigInt as string
    "deltaFormatted": "$10,000.00 in ETH at block price",
    "realTxHash": "0x...",
    "counterfactualRoot": "0x...",
    "proofDigest": "0x...",
    "recordedAt": "2026-04-15T14:23:15.100Z"
}
```

### Ledger Counterfactual Tree

```
GET /ledger/:eventId/counterfactual-tree
200: {
    "root": "0x...",
    "leaves": [
        { "address": "0x...", "label": "VictimPool", "realBalance": "1000", "shadowBalance": "0", "delta": "-1000" },
        ...
    ]
}
```

### Policy

```
GET /policy/current
200: {
    "hash": "0x...",
    "version": 3,
    "document": {...},        // full policy JSON
    "updatedAt": "...",
    "txHash": "0x..."
}

GET /policy/history
200: { "policies": [...] }   // array of historical policies
```

### Threat Registry

```
GET /threats/registry
200: {
    "signatures": [
        {
            "signatureHash": "0x...",
            "defensePrimitive": "pause",
            "confidence": 9500,
            "publishedAt": "..."
        }
    ]
}

GET /threats/registry/:signatureHash
200: full signature record
```

### Simulation Replay (for demo)

```
POST /demo/replay-scenario
Body: { "scenario": "flash-loan-oracle-manip" }
200: { "eventId": "0x...", "replayStarted": true }
```

Triggers the demo scenario. Causes the FlashLoanAttacker contract to execute its scripted attack. The full pipeline responds naturally.

### Inject Instruction (Agent Constraint Demo)

```
POST /demo/inject-instruction
Body: { "target": "0x...", "calldata": "0x...", "reason": "demo" }
200: { "eventId": "0x...", "submitted": true }
```

The agent receives the injected instruction. The rejection flow executes. Frontend observes via WebSocket.

---

## WebSocket API

URL: `ws://localhost:8081/ws`

### Connection Flow

```
client → server: { "op": "hello", "version": "1.0" }
server → client: { "op": "welcome", "serverTime": "...", "subscriptionsAvailable": [...] }

client → server: { "op": "subscribe", "channel": "events.all" }
server → client: { "op": "subscribed", "channel": "events.all" }

// events flow on the channel
server → client: { "op": "event", "channel": "events.all", "data": EventEnvelope }

client → server: { "op": "unsubscribe", "channel": "events.all" }
client → server: { "op": "ping" }
server → client: { "op": "pong", "ts": "..." }
```

### Channels

| Channel | Payload | Purpose |
|---------|---------|---------|
| `events.all` | EventEnvelope | All events (firehose, for dashboard) |
| `events.eventId:<id>` | EventEnvelope | Single event lifecycle |
| `mempool.pending` | PendingTxEvent | Every pending tx (heavy; debug only) |
| `defense.submitted` | DefenseSubmittedEvent | Defense tx goes out |
| `defense.mined` | DefenseMinedEvent | Defense tx confirmed |
| `counterfactual.ready` | CounterfactualReadyEvent | δ computed |
| `ledger.recorded` | LedgerRecordedEvent | On-chain ledger entry committed |
| `prover.progress` | ProofProgressEvent | Live proof-gen progress |
| `trust.collapse` | TrustCollapseUpdate | UI choreography cues |
| `battlefield.tick` | BattlefieldUpdate | Red/Blue arms race updates |
| `immunity.propagation` | ImmunityPropagationTick | Node-by-node propagation animation |

### EventEnvelope

```json
{
    "channel": "events.all",
    "messageId": "uuid",
    "emittedAt": "2026-04-15T14:23:08.180Z",
    "kind": "THREAT_CONFIRMED" | "DEFENSE_SUBMITTED" | ...,
    "data": { ... }
}
```

### Trust Collapse Cues

For the Trust Interface to be choreographed precisely, api-gateway emits explicit UI state cues:

```json
{
    "kind": "TRUST_COLLAPSE_CUE",
    "data": {
        "eventId": "0x...",
        "state": "AMBIGUITY" | "SUSPICION" | "PROOF_INJECTION" | "RESOLVED",
        "message": "Contract paused at block #12345.",
        "underlyingTxHash": "0x...",
        "proofDigest": "0x..." | null,
        "verifierCall": {
            "contract": "PolicyVerifier",
            "method": "verify",
            "args": [...]
        } | null
    }
}
```

The frontend uses this to advance its UI without needing timing logic.

### Battlefield Updates

```json
{
    "kind": "BATTLEFIELD_TICK",
    "data": {
        "generation": 42,
        "redNodes": [{ "id": "...", "patternType": "...", "success": false }, ...],
        "blueNodes": [{ "id": "...", "policyVersion": 3, ... }],
        "attempts": [
            { "redId": "...", "blueId": "...", "outcome": "blocked" },
            ...
        ],
        "winRate": 0.94
    }
}
```

For MVP, battlefield data is pre-recorded and replayed. The structure matches what a live loop would produce so swapping to live is transparent.

---

## Schema Versioning

All JSON payloads include a `schema` field with format `<Name>@<major>`. Breaking changes increment major and ship parallel. Frontend pins the schemas it understands and rejects unknown. Schemas live in `/schemas/*.json`.

Example:

```json
{
    "schema": "ThreatConfirmedEvent@1",
    ...
}
```

## Rate Limits (future)

Not in MVP. Target: 100 req/min per client on REST, no limits on WS.

## Error Responses

```json
{
    "error": {
        "code": "POLICY_RULE_NOT_FOUND",
        "message": "No rule in current policy matches pattern OPERATOR_OVERRIDE",
        "details": { ... },
        "correlationId": "..."
    }
}
```

HTTP status codes:
- 400 — client error (bad input)
- 404 — not found
- 409 — conflict (e.g. event already recorded)
- 422 — semantic error (e.g. proof generation rejected)
- 500 — internal
- 503 — downstream service unavailable

## CORS

Allowed origins for dev: `http://localhost:3000`. Configure in `/config/gateway.json`.
