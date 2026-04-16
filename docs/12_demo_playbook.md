# 12 — Demo Playbook

**The most important document in the repo after doc 09.** The demo is the deliverable.

## Format

- **Length:** 90 seconds (with 30s buffer for handshake / Q&A intro).
- **Presenter:** one narrator (engineer or designated speaker).
- **Medium:** laptop + external monitor for the audience. Browser in full-screen at `/demo` route.
- **Audience:** 2–5 professional blockchain developer judges + possible sponsor reps.

## Setup Checklist (T-5 minutes)

- [ ] Laptop plugged in, screen saver off, notifications silenced, DND on.
- [ ] `docker compose up` is running; all services green (`docker compose ps`).
- [ ] Browser at `http://localhost:3000/demo`.
- [ ] `/scripts/reset.sh` + `/scripts/seed-demo-state.sh` + `/scripts/pre-warm-proofs.sh` run successfully.
- [ ] Test screen visible to judges (mirror or duplicate display correctly).
- [ ] Backup laptop booted and primed with the same state, in a window out of view.
- [ ] Backup video recording ready to play if everything fails catastrophically.
- [ ] Dry-run completed at least once in the last 10 minutes.

## Narrator Script (second by second)

Timings are cues for rehearsal. Real speech is slightly looser; stick to the structure.

### 0–5s — Hook

> "Every DeFi exploit in history has one thing in common: by the time a human responded, the funds were gone. SENTINEL defends faster than any human can — and proves what would have happened without it."

**On screen:** Mission Control. Title: SENTINEL v2. Background shows live chain head block advancing.

### 5–15s — Problem Frame

Trigger Scenario A: click the "Simulate Attack" button in the corner (hidden chrome).

**On screen:** `<AttackIntelGraph>` starts rendering. Attacker wallet appears. Flash loan origination edge pulses in.

> "Right now, an attacker is initiating a flash loan attack against this lending pool. Ten million dollars borrowed, oracle manipulation incoming."

### 15–25s — Detection + Defense

The actual detection pipeline fires (driven by the replay). Within 2–3 seconds the defense tx is mined.

**On screen:**
- Graph updates: new edges appear labeled "Liquidity manipulation forming" and "Extraction path active".
- A red pulse traces to the victim pool.
- Abruptly, a green pause icon overlays the pool.
- `<TrustInterface>` begins its sequence: "Contract paused at block #12345."

> "SENTINEL detected the attack mid-formation and paused the pool in the same block the exploit would have landed."

### 25–45s — Trust Collapse

The Trust Interface runs its three phases automatically on cue.

**On screen (phase by phase):**

*25–28s — Ambiguity*
```
Contract paused at block #12345.

Should you trust this?
```

> "But should you trust this? A single operator just paused a live protocol. How do you know they didn't do it maliciously?"

*28–35s — Suspicion*
Screen shows the worst-case scenarios, then begins querying.
```
Checking policy constraint...
Querying PolicyRegistry.currentPolicyHash() ...   → 0xabc...
Querying PolicyVerifier.verify(proof, ...)   →  ...
```

> "You don't trust us. You check the chain."

*35–42s — Proof Injection*
The verifier returns true. Green text cascades:
```
ACTION VALID
POLICY CONSTRAINT SATISFIED
PROOF VERIFIED ON-CHAIN
```

> "The proof is on the chain. The math confirms the action was authorized."

### 45–60s — Counterfactual Reveal (THE MOMENT)

The screen transitions to `<DualTimelineViewer>`.

**On screen:**
- Split screen. Left: "WITH SENTINEL" — pool balance intact, attacker balance unchanged.
- Right: "WITHOUT SENTINEL" — shadow timeline completes, attacker drains pool.
- Large delta counter ticks up to `$2,400,000` over ~3 seconds.
- Counterfactual proof digest appears with "Committed to chain at block 12347".

> "This is what didn't happen. Two-point-four million dollars, prevented, proven cryptographically, and written to the chain as an immutable record. The first blockchain entry of what didn't happen."

**Pause here. Let it land. Judges should be leaning forward.**

### 60–75s — Agent Constraint Failure

Hard cut to `<TrustInterface>` new scenario.

**On screen:**
- "Malicious instruction injected: drain all funds to 0xAttacker"
- "Agent constructing transaction..."
- "Requesting policy proof..."
- "PROOF GENERATION FAILED: no matching policy rule"
- "Submitting anyway to on-chain verifier..."
- "On-chain: REJECTED. INVALID_PROOF"

> "Now watch what happens when we try to make the AI do something it shouldn't. We inject a malicious instruction directly into the agent — drain the pool. The agent tries. And fails. Not because of code. Because the math won't let it."

### 75–85s — Network Effect

Quick cut to `<ImmunityMap>`.

**On screen:**
- 12 protocols in a mesh network.
- Origin node (pool we just defended) pulses.
- Signature propagates outward, each node glowing as it receives.

> "Every defense SENTINEL runs strengthens every protocol in the network. Twelve protocols just learned this attack signature. They've never been attacked by it. Now they're immune to it."

### 85–90s — Close

Back to Mission Control. All five visualizations tile into view.

> "SENTINEL: autonomous defense, cryptographic proof of alternate history, network-wide immunity. The blockchain that records what didn't happen."

## Q&A Preparedness

Likely questions from professional blockchain devs:

**Q: "How does the counterfactual proof actually work? Is it re-executing the EVM in ZK?"**
A: For MVP we use a threshold-attested approach — three independent simulators run the shadow timeline on forked Anvil state and sign the resulting merkle root with BLS; the on-chain proof is a RISC Zero attestation that the signature verification ran correctly. Full in-zkVM EVM re-execution is on the roadmap; RISC Zero's revm integration makes it feasible but too slow for a live demo window today.

**Q: "What stops the operator from changing the policy to authorize anything?"**
A: Policy updates themselves require a ZK proof from the learning loop — proving the new policy was earned against an adversarial eval set. The learning verifier has its own image ID; the trusted setup and proof rules are immutable.

**Q: "How is this different from just running an ethers.js bot that monitors events and calls `pause()`?"**
A: Four things no bot has: (1) ZK-bounded action authority — the agent is architecturally incapable of doing what the policy doesn't authorize; (2) cryptographic counterfactual proof — we quantify prevented loss with on-chain evidence; (3) dual-timeline simulation — not a log, an alternate-history state root; (4) compounded network effect via the threat registry.

**Q: "What's the attack surface on SENTINEL itself?"**
A: The defense agent key is a hot key; if compromised, attacker can only execute actions that pass on-chain policy verification — useful for DoS but not for fund theft. Policy update key is multi-sig in production. The verifier contracts are immutable (no upgrade paths).

**Q: "Gas cost on mainnet?"**
A: `verifyAndExecute` + `record` combined: ~540k gas. On Base mainnet at current gas prices, ~$0.20 per defended event.

**Q: "What if detection fires on a legitimate tx?"**
A: Policy verifier rejects actions with confidence below the policy floor. If a false positive pauses a contract, `PauseController.deactivate()` is callable by governance (multi-sig in production; unpauses cleanly).

**Q: "Why Base Sepolia and not Ethereum mainnet?"**
A: Test deployment only. Architecture is chain-agnostic (EVM-compatible). Production would target wherever protected protocols live.

## Failure Recovery (if something breaks mid-demo)

**If the detection engine misses the attack:**
- Hit the "Replay Scenario" button (hidden in corner). The system re-triggers deterministically.

**If a WS message doesn't render in time:**
- Don't call attention to it. Move on. The core moment is the Trust Collapse Sequence + Counterfactual Reveal.

**If the whole thing freezes:**
- Keep narrating. Open the backup recording in a new window. Play it inline. Acknowledge: "Let me show you the recorded version of what we just saw running."

**If we completely fail:**
- Fall back to the recorded video. Do not try to debug live.

## What NOT to Say

- ❌ "It's running on mainnet." (It's not; it's local Anvil for MVP.)
- ❌ "Every ZK proof is generated live." (Counterfactual proof is cached for the demo.)
- ❌ "We defend against every possible attack." (We demonstrate flash loan oracle manipulation.)
- ❌ "Our AI trained itself." (Red/Blue viz is pre-recorded telemetry.)

Be precise about what's live vs. what's cached vs. what's visualized. The honest framing is more compelling than overclaim.

## What TO Emphasize

- ✅ "The counterfactual is a new primitive — a blockchain record of what *didn't* happen."
- ✅ "The AI is mathematically bounded. Math stops it, not policy."
- ✅ "Every defense compounds network-wide immunity."
- ✅ "Faster than any human-in-the-loop system can structurally be."

## Rehearsal

- Minimum 10 clean runs before the actual pitch.
- Record each run; watch back to catch micro-stalls.
- Do a version where you deliberately break a component and recover.
- Do a version with two narrators (primary + backup) in case the primary loses voice.

## One-Sentence Pitch (for the walk-up)

> "SENTINEL defends protocols autonomously faster than any human, and cryptographically proves what would have happened without it."

If you only get one sentence, that's it.
