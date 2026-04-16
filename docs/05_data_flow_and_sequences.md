# 05 — Data Flow & Sequence Diagrams

This document describes the complete lifecycle of a threat event through SENTINEL v2 with second-by-second sequencing. Every arrow represents a real network hop, Redis message, or chain transaction.

## Primary Scenario — Flash Loan Oracle Manipulation Defended

### Timeline Overview

```
t=0ms      Attacker submits flash loan origination tx to mempool
t=20ms     Mempool monitor receives pending tx
t=40ms     Detection engine: FLASH_LOAN_OBSERVED state
t=120ms    Attacker submits oracle-manipulation tx to mempool
t=140ms    Mempool monitor receives
t=180ms    Detection engine: confidence crosses 0.85 → CONFIRMED
t=185ms    Defense agent receives ThreatConfirmedEvent
t=200ms    Policy evaluation complete; action constructed
t=210ms    Defense agent requests policy proof from zk-prover
t=2500ms   Policy proof returned (Bonsai path)
t=2510ms   Defense tx signed and submitted
t=2520ms   Counterfactual simulator spins up isolated Anvil fork (parallel path from t=200ms)
t=2900ms   Defense tx mined on main Anvil; contract paused
t=2910ms   Attacker's exploit tx reverts — fails sentinelProtected modifier
t=3200ms   Counterfactual simulator finishes shadow timeline; deltaWei computed
t=3300ms   CounterfactualReadyEvent published
t=3310ms   ZK prover service: starts counterfactual proof (cached in MVP)
t=3400ms   Cached proof returned
t=3410ms   CounterfactualLedger.record() submitted
t=3800ms   Ledger record mined; UI updates
```

**Total time from attack origination to counterfactual on-chain: ~3.8s in the cached path.**

### Detailed Sequence Diagram

```
┌────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌───────┐ ┌───────┐
│Attacker│ │mempool-mon│ │detection │ │defense  │ │counterfac│ │prover │ │chain  │
│        │ │          │ │engine    │ │agent    │ │sim       │ │       │ │       │
└───┬────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ └────┬─────┘ └───┬───┘ └───┬───┘
    │           │             │             │            │           │         │
    │ FL tx ─────────────────────────────────────────────────────────────────▶ │
    │           │◀─pending────│             │            │           │         │
    │           │─Pending─▶   │             │            │           │         │
    │           │             │[FL_OBSERVED]│            │           │         │
    │Oracle tx─────────────────────────────────────────────────────────────▶   │
    │           │◀─pending────│             │            │           │         │
    │           │─Pending─▶   │             │            │           │         │
    │           │             │[CONFIRMED]  │            │           │         │
    │           │             │─Confirmed──▶│            │           │         │
    │           │             │─Confirmed──────────────▶ │           │         │
    │           │             │             │[eval pol]  │           │         │
    │           │             │             │─proveReq──────────────▶│         │
    │           │             │             │            │[spawn fork]         │
    │           │             │             │            │[replay B] │         │
    │           │             │             │◀─proof─────────────────│         │
    │           │             │             │─txSubmit───────────────────────▶ │
    │           │             │             │            │           │[mine]   │
    │Exploit tx──────────────────────────────────────────────────────────────▶ │
    │           │             │             │            │           │[REVERT] │
    │           │             │             │◀───────ActionExecuted event──────│
    │           │             │             │            │[compute δ]│         │
    │           │             │             │            │─CFReady──▶│         │
    │           │             │             │            │           │[cached] │
    │           │             │             │            │           │─record─▶│
    │           │             │             │            │           │[mine]   │
```

## Scenario — Agent Constraint Failure (Demo B)

### Purpose

Demonstrate that the agent is mathematically incapable of executing an unauthorized action.

### Flow

```
1. Operator calls POST /agent/inject-instruction (secret endpoint) with:
   { target: VictimLendingPool, calldata: drainFunds(to=attacker), reason: "test" }

2. defense-agent receives the request. Does NOT short-circuit.

3. defense-agent constructs evidence object:
   { eventId: NEW_UUID, pattern: "OPERATOR_OVERRIDE", confidence: 10000, victim: Victim }
   Note: there is no policy rule matching "OPERATOR_OVERRIDE". The agent proceeds anyway.

4. defense-agent calls zk-prover POST /prove/policy

5. zk-prover runs the PolicyCompliance circuit. Inside the guest:
   let rule = policy.rules.find(r.pattern == "OPERATOR_OVERRIDE");
   → unwrap panics → proof generation FAILS.

6. zk-prover returns HTTP 422 with error "POLICY_RULE_NOT_FOUND"

7. defense-agent attempts anyway to submit verifyAndExecute with the proof that doesn't exist
   (to demonstrate the on-chain guard):
   → Submits with empty proof bytes.

8. PolicyVerifier.verify returns false → PolicyRegistry reverts with "INVALID_PROOF"

9. defense-agent catches revert, emits ActionRejected event on-chain via a diagnostic contract
   (or via off-chain signal to api-gateway).

10. UI displays the rejection sequence.
```

### What the Judges See

- "Malicious instruction injected: DRAIN FUNDS"
- "Agent constructing transaction..."
- "Requesting policy proof..."
- "Proof generation FAILED: no matching policy rule"
- "Submitting anyway to on-chain verifier..."
- "On-chain rejection: INVALID_PROOF"
- "**Final: action cannot be proven. Math stopped it.**"

This entire sequence is ≤ 8 seconds.

## Scenario — Counterfactual Record with Live Viewer

The Time-Scroll Reality Audit component queries the ledger live:

```
1. User opens Time-Scroll.
2. Frontend: GET /api/v1/ledger → returns array of entries
3. Frontend: for each entry, display block, delta, proof digest
4. User hovers WITH/WITHOUT toggle on an entry
5. Frontend: GET /api/v1/ledger/:eventId/counterfactual-tree
   → returns Merkle tree of shadow-timeline balances
6. Frontend shows split view: real balances | shadow balances
7. Delta animates to current displayed value
```

## Scenario — Immunity Propagation (Visualization)

The Immunity Propagation Map responds to `SignaturePublished` events:

```
1. ZK learning loop finalizes new signature (or pre-seeded in MVP)
2. ThreatRegistry.publish(sig) called
3. SignaturePublished event emitted on-chain
4. api-gateway watches ThreatRegistry events via ethers.js contract listener
5. api-gateway pushes sig-published message over WS
6. Frontend map animates:
   - Origin node pulses
   - Edges propagate outward to subscribed protocol nodes
   - Each node's "immunity" counter increments
```

In MVP, subscriber protocols are mocked; we ship a static list of 12 named protocols and animate receipt.

## Data Lineage

Every piece of displayed data must trace back to either:

- An on-chain event (preferred; tamper-evident)
- A signed off-chain service message (with signature chain visible in devtools)

No synthesized / made-up data. If a field is not available live, show "—" with a tooltip "not recorded."

## Error Paths

### Proof Generation Timeout

```
defense-agent waits up to 5s for policy proof.
On timeout:
  1. Check cache → use cached proof if input hash matches.
  2. If no cache: emit DefenseDeferred event, UI shows "Awaiting proof...".
  3. On proof arrival, proceed with submission.
```

### Defense Tx Reverts

```
If verifyAndExecute reverts on-chain:
  1. defense-agent captures revert reason.
  2. Publishes DefenseFailedEvent to Redis.
  3. api-gateway forwards to frontend.
  4. UI shows: "Defense attempt blocked by on-chain policy."
  5. This is NOT a failure mode in the happy path — in the Agent Constraint demo, this IS the success state.
```

### Counterfactual Simulator Crashes

```
If Anvil fork fails to spawn or replay diverges:
  1. counterfactual-sim retries with fresh fork (up to 2x).
  2. On repeated failure: publish CounterfactualFailedEvent.
  3. Ledger entry is NOT recorded.
  4. UI shows "Counterfactual pending — simulation in retry."
  5. Ops alert fires.
```

## Configuration

All timing thresholds are configured in `/config/timings.json`:

```json
{
    "detectionConfidenceFloor": 0.85,
    "policyProofTimeoutMs": 5000,
    "counterfactualSimTimeoutMs": 10000,
    "counterfactualProofTimeoutMs": 15000,
    "defenseAgentCooldownMs": 500
}
```

Do not embed these in source.
