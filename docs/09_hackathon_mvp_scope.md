# 09 — Hackathon MVP Scope

**This is the most important document in this repo. Read it twice.**

The v2 vision is a multi-month product. What we build in 24 hours is a deliberately narrowed slice designed to produce the demo in doc 12. Anything outside this scope is a STRETCH GOAL or POST-HACKATHON.

## Hard Scope — In

These must exist, run live, and be demonstrable.

### 1. Contracts (Foundry)

- `PolicyRegistry.sol` — fully functional with ZK verification.
- `CounterfactualLedger.sol` — fully functional.
- `PauseController.sol` — pause primitive only (no rate limit / quarantine for MVP).
- `SentinelGuard.sol` — read-only integration API.
- `VictimLendingPool.sol` — vulnerable demo protocol.
- `FlashLoanAttacker.sol` — demo attack script contract.
- `PolicyVerifier.sol` (generated) — Groth16 verifier for PolicyCompliance circuit.
- `CounterfactualVerifier.sol` (generated) — Groth16 verifier for CounterfactualCorrectness circuit.

**Cut:** `QuarantineVault`, `LearningVerifier`, `ThreatRegistry` (deploy as empty stub for UI integration).

### 2. Off-chain Services

- `mempool-monitor`: functional, watches local Anvil. **In.**
- `detection-engine`: ONE pattern (FLASH_LOAN_ORACLE_MANIP). **In.**
- `defense-agent`: evaluates policy, requests ZK proof, submits tx. **In.**
- `counterfactual-sim`: forks Anvil, runs shadow timeline, computes δ. **In.**
- `zk-prover`: PolicyCompliance circuit live. CounterfactualCorrectness circuit cached. **In.**
- `api-gateway`: REST + WS with the subset of endpoints listed below. **In.**

**Cut:** `learning-loop` (Red/Blue training) — visualization only, pre-recorded.

### 3. ZK Circuits

- **PolicyCompliance** — LIVE. Real proof generation path, cache fallback.
- **CounterfactualCorrectness** — simulated correctness via BLS threshold attestation (Approach B from doc 04), with one cached hero proof for the demo flow.

**Cut:** `LearningLoopCorrectness`.

### 4. Frontend

- `<TrustInterface>` — live, choreographed. **In.**
- `<AttackIntelGraph>` — live, driven by real mempool events. **In.**
- `<DualTimelineViewer>` — live δ display. **In.**
- `<TimeScrollAudit>` — live, shows real recorded events. **In.**
- `<BattlefieldViz>` — PRE-RECORDED animation, loops. **In (as animation).**
- `<ImmunityMap>` — triggered by demo, pre-scripted propagation. **In.**
- `<ProofViewer>` — live on-chain verifier call. **In.**
- `<DemoOrchestrator>` — drives the full scenario. **In.**

### 5. Demo Scenarios

- **Scenario A — Flash Loan Oracle Manipulation, Defended.** Full end-to-end. Live. **In.**
- **Scenario B — Agent Constraint Failure.** Full end-to-end. Live. **In.**

**Cut:** reentrancy scenario, governance attack scenario, pre-emptive strike scenario.

## Hard Scope — Out

These DO NOT SHIP for the hackathon. If you find yourself working on one, stop.

- Layer 6 (Pre-emptive Strike Engine) — complete omission.
- Real Red/Blue adversarial training (only visualization).
- Cross-protocol threat registry live publication (UI only).
- Quarantine vault with time-locked release.
- Multi-protocol support (only `VictimLendingPool`).
- Multi-chain support.
- Bonsai-only production path (keep local fallback).
- Grafana dashboards (metrics endpoints present; visualization is polish).
- Real authentication / JWT.
- Production-grade error recovery beyond MVP (see below).

## Hour-by-Hour Build Plan (24 hours)

Assumes 4 engineers, all experienced.

### Hour 0–2 — Setup & Alignment

- All 4 read README, doc 00, doc 09, doc 12. (15 min)
- Clone repo, bootstrap environment, confirm local Anvil boots and deploys stub contracts. (30 min)
- **SYNC:** Everyone confirms their docs are clear. Any ambiguity → raise now.
- Split work per team assignments in README.

### Hour 2–6 — Core Contracts + ZK Policy Circuit

Engineer 1 (contracts + ZK):
- Scaffolds all contracts with tests.
- Writes PolicyCompliance guest program. Generates verifier.
- Confirms local proving works (accept 30s proof time at this point).

Engineer 2 (backend):
- Mempool monitor + detection engine skeleton.
- Publishes ThreatConfirmedEvent on test triggers.

Engineer 3 (frontend):
- Vite project scaffolded.
- WS client connected.
- `<TrustInterface>` skeleton renders phases on fake cues.

Engineer 4 (integration):
- VictimLendingPool + FlashLoanAttacker with tests confirming the attack actually succeeds without SENTINEL.
- Writes `/scripts/seed-demo-state.sh`.

**Checkpoint at hour 6:** end-to-end "hello world" — mempool event → detection → defense agent → submitted tx → UI event. Can be faked at this stage; just the wiring.

### Hour 6–12 — Counterfactual + Live Integration

Engineer 1:
- Integrates Bonsai. Proof time drops to seconds.
- Writes CounterfactualCorrectness threshold-attestation circuit. Cache one hero proof.

Engineer 2:
- Counterfactual simulator working with Anvil forks.
- Defense agent submits real policy proofs; real verifyAndExecute on-chain.

Engineer 3:
- `<TrustInterface>` driven by real api-gateway cues.
- `<AttackIntelGraph>` renders real mempool data.
- `<DualTimelineViewer>` reads from ledger REST endpoint.

Engineer 4:
- Seed script populates demo state cleanly.
- Integration test: running FlashLoanAttacker WITHOUT SENTINEL drains the pool.
- Running WITH SENTINEL pauses the pool in time.

**Checkpoint at hour 12:** Scenario A runs end to end live, though possibly slowly.

### Hour 12–18 — Agent Constraint Demo + Polish

Engineer 1:
- Agent Constraint Failure flow. Confirms proof generation fails for injected instruction.
- Verifier contract on-chain correctly rejects empty/invalid proof.

Engineer 2:
- `POST /demo/inject-instruction` endpoint.
- Error path from defense agent → publishes ActionRejected cue to WS.

Engineer 3:
- `<TrustInterface>` handles the rejection flow (alternate phases: Ambiguity → Submission → Rejection → Proof-Failure-Detail).
- `<BattlefieldViz>` pre-recorded animation loop.
- `<ImmunityMap>` triggered animation.

Engineer 4:
- `<DemoOrchestrator>` drives the full scenario timings.
- Stress-test full flow; identify race conditions.

**Checkpoint at hour 18:** Both scenarios run clean back-to-back in demo mode. Record a dry-run video.

### Hour 18–22 — Demo Hardening

- Pre-warm proof cache.
- Fix any UI jank.
- Add graceful degradation paths.
- Write talking-point cue cards for narrator.
- Run the full 90-second demo 10 times in a row. Fix the most common failure mode each round.

### Hour 22–24 — Ops & Sleep

- Run demo on backup laptop. Confirm reproducibility.
- One engineer stays responsible for the demo rig; others sleep.
- Do NOT ship new features in the last 2 hours.

## Shortcuts That Are Allowed

These are deliberate hackathon-time shortcuts that do not compromise correctness of what we claim:

1. **Cached counterfactual proofs for the demo flow.** Label: "verified via pre-computed attestation proof (3-of-5 simulator signatures)." True, defensible.
2. **Pre-seeded threat registry signatures.** Label: "signatures from prior detected events." If anyone asks, we can show where the signatures came from (fuzzed variants of real historical exploits: Euler, Cream, Ronin).
3. **Battlefield visualization is pre-recorded.** Label: "loop telemetry from 10,000 training generations." Generate this telemetry from a real background run during the build — not manually authored. Critical distinction: the data is real, the playback is scheduled.
4. **Immunity propagation node list is static.** Label: "12 protocols in the pilot registry." Honest framing.

## Shortcuts That Are NOT Allowed

Any of these in the demo script invalidates the trust of the system. Do not take these shortcuts.

- ❌ Fake the on-chain verifier call in `<TrustInterface>`. It must be a real `eth_call`.
- ❌ Hard-code the counterfactual delta. It must come from a real Anvil shadow timeline (even if the proof is cached).
- ❌ Simulate the Agent Constraint Failure — the agent must actually try and fail.
- ❌ Skip the real defense tx on-chain. The pause must actually happen on Anvil.

The demo is only convincing if the system is real. Cutting a corner anywhere in the "visible" path destroys the entire narrative.

## Quality Gates

Before calling the MVP complete:

- [ ] `forge test` green, 100% of targeted tests passing.
- [ ] `pnpm test` green across all TS services.
- [ ] `poetry run pytest` green across all Python services.
- [ ] End-to-end replay of Scenario A completes in < 10s with the cached proof.
- [ ] End-to-end replay of Scenario B completes in < 8s.
- [ ] 10 consecutive clean demo runs.
- [ ] Dry-run video recorded as evidence the system works.

## Risk Register (Hackathon)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| RISC Zero toolchain issues on team machines | Medium | Pre-test on each machine before kickoff; keep Docker-based build as fallback |
| Anvil mempool subscription unreliable | Low | Manual polling fallback in mempool-monitor |
| Bonsai rate limits / outage | Medium | Local prover fallback; cache aggressively |
| Detection false positive during demo | High (any flaky day) | Demo mode uses deterministic triggering via `POST /demo/replay-scenario` |
| Frontend animation jank under load | Medium | SENTINEL_DEMO_SAFE mode reduces node counts |
| Live WS disconnect mid-demo | Low | Auto-reconnect + deterministic replay of demo scenario |

## Final Reminder

Doc 12 is the demo. Everything in this doc is justified or deleted by reference to doc 12. If a feature doesn't serve doc 12, it gets cut. If doc 12 requires something not listed here, raise it immediately.
