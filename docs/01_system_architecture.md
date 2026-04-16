# 01 — System Architecture

## Component Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                            │
│  Trust Interface | Attack Graph | Time-Scroll | Battle | Immunity   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │  WebSocket + REST
┌────────────────────────────────▼────────────────────────────────────┐
│                     API GATEWAY (Fastify + WS)                       │
│              /api/v1/*   +   ws://events                             │
└────┬───────────────┬──────────────┬─────────────┬──────────┬────────┘
     │               │              │             │          │
┌────▼────┐   ┌─────▼──────┐   ┌───▼────┐   ┌────▼────┐  ┌──▼─────────┐
│ Mempool │   │ Detection  │   │Defense │   │Counter- │  │ ZK Prover  │
│ Monitor │──▶│   Engine   │──▶│ Agent  │──▶│factual  │─▶│  Service   │
│  (TS)   │   │  (Python)  │   │(Python)│   │ Sim     │  │(RISC Zero) │
└─────────┘   └────────────┘   └────┬───┘   │(Anvil)  │  └─────┬──────┘
                                    │       └────┬────┘        │
                                    │            │             │
                    ┌───────────────▼────────────▼─────────────▼──────┐
                    │            Redis Event Bus (pub/sub)             │
                    └───────────────┬──────────────────────────────────┘
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     │                              │                              │
┌────▼───────────┐           ┌──────▼──────┐             ┌─────────▼──────┐
│  Red/Blue      │           │ On-Chain    │             │ Postgres       │
│  Learning Loop │           │ Contracts   │             │ (event store)  │
│  (Python)      │           │ (Foundry)   │             │                │
└────────────────┘           └─────────────┘             └────────────────┘
```

## The Six Layers

### Layer 1 — Detection & Response

**Components:** Mempool Monitor, Detection Engine, Defense Agent.
**Runtime:** 3 isolated services communicating via Redis pub/sub.
**SLA:** From pending-tx arrival at mempool monitor to defense transaction submission: **< 800ms**. Detailed budget in doc 03.

### Layer 2 — Dual-Timeline Execution

**Components:** Counterfactual Simulator (Anvil driver), Timeline State Manager.
**Mechanism:** When a detection event fires, we snapshot chain state at block N-1. Timeline A runs the real sequence (attack tx + defense tx). Timeline B runs the counterfactual (attack tx, no defense). We compute `delta = balance_change_B - balance_change_A` across all protocol-relevant addresses. We publish `delta` along with a ZK proof of simulation correctness.

### Layer 3 — ZK Recursive Learning

**Components:** Red Agent, Blue Agent, Adversarial Loop Runner, Policy Diff Prover.
**Runtime:** Long-running background service. Each "generation" is a batch of N Red-generated attacks evaluated against Blue. Policy update only commits if win rate ≥ threshold τ.
**ZK proof:** Attest that (a) the loop ran completely, (b) the win rate was genuinely achieved against a held-out eval set, (c) the policy diff committed on-chain matches the policy that earned the win rate.

### Layer 4 — Trust Interface (Live)

**Components:** Frontend Trust Collapse component, Policy Verifier, Action Verifier.
**Mechanism:** For every defense event, the frontend walks the user through three UI states (Ambiguity → Suspicion → Proof Injection) while querying on-chain contracts in the background. When the final query resolves with `verifier.verify(action, proof) == true`, the UI resolves.

### Layer 5 — Visualization Suite

**Components:** Five distinct React components sharing a common WebSocket event stream.
**See:** doc 07 for full component tree.

### Layer 6 — Pre-emptive Strike

**Components:** Mempool Precursor Classifier, Gas-Priority Submitter.
**Mechanism:** Classify mempool tx as precursor signature of an attack pattern. If precursor confidence + severity prediction > threshold, submit defense tx with gas priority bid above predicted attack tx. Attack tx arrives to find the defense already executed.
**Hackathon note:** Layer 6 is out of MVP scope. See doc 09.

## Integration Surfaces

### Protocols That Want Protection

A protocol integrates with SENTINEL by adding a modifier to their contract functions:

```solidity
modifier onlyIfSentinelAllows() {
    require(SentinelGuard(sentinelAddress).isAllowed(msg.sender, msg.sig), "SENTINEL: halted");
    _;
}
```

Or by accepting a `PauseController` as an upgrade admin. Details in doc 02.

### Chains Supported (MVP)

- **Local:** Anvil (Foundry), chainID 31337. This is where the demo runs.
- **Deployment target:** Base Sepolia (testnet). Chosen because Base has cheap ZK verifier gas and is EVM-standard.

No mainnet deployment for the hackathon. All "on-chain" references mean the local Anvil instance, which is a real EVM chain with real signatures and real state — just local.

## Threat Model (What We Defend Against vs. What We Don't)

**In scope:**
- Flash loan–origin oracle manipulation (primary demo scenario)
- Reentrancy attempts
- Liquidity drain via coordinated wallet clusters
- Governance attacks via rapid token accumulation

**Out of scope (explicit):**
- Validator-level MEV and block reorg attacks
- Social engineering / admin key compromise of the protected protocol
- Attacks targeting SENTINEL's own infrastructure (out of scope for v2)
- Zero-day protocol bugs unrelated to known economic patterns

## Security Invariants (System-Wide)

The following invariants **must** hold at all times. Any code that can violate them is a bug.

1. **No defense action commits on-chain without a validated policy proof.** Enforced by `PolicyRegistry.verifyAndExecute()`.
2. **No policy update commits on-chain without a validated learning proof.** Enforced by `PolicyRegistry.updatePolicy(proof)`.
3. **No counterfactual claim is published without a simulation proof.** Enforced by `CounterfactualLedger.record(entry, proof)`.
4. **Quarantined funds can only be returned to the original protocol via a time-locked governance call.** Enforced by `QuarantineVault`.
5. **The detection engine cannot itself submit transactions.** Only the defense agent, gated by policy contract, can submit.

## Design Choices & Rationale

| Choice | Why |
|--------|-----|
| Redis pub/sub (not Kafka) | Lower latency for MVP; swap to Kafka if scaling |
| Anvil for sim (not Hardhat) | Faster fork creation (~10ms), supports `anvil_reset` |
| RISC Zero (not Groth16 for every circuit) | General-purpose ZK VM — we can prove arbitrary Rust code. Simulation correctness is too complex for handwritten circuits. |
| Python for agents | Mature ML / RL libraries; OK latency when pre-warmed |
| TypeScript for mempool monitor | ethers.js is the canonical mempool library; JS event loop suits streaming |
| Fastify for API gateway | Fastest Node framework; schema-based validation matches our strict API contracts |
| React + D3 frontend | Graph viz is the demo's visual core; D3 gives us force-directed layouts for free |

## What Breaks the System

Every engineer should know these failure modes cold:

- **Anvil fork desync:** if block numbers drift between real chain and fork, counterfactual delta is wrong. Mitigation: fork at every event, no reuse.
- **Proof generation timeout:** if RISC Zero takes > 30s, the demo stalls. Mitigation: pre-generated proofs for demo scenarios + live proof for the "hero" flow.
- **Detection false positive:** if detection fires on a legitimate tx, policy verifier should reject the defense action. Mitigation: policy encodes the required attack confidence floor.
- **Redis outage:** bus is single point of failure. Mitigation: in-process fallback channels for MVP.
