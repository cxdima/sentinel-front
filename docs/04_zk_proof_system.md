# 04 — ZK Proof System

SENTINEL v2 uses **RISC Zero** as the universal ZK backend. RISC Zero is a zkVM — we write Rust code and it generates a STARK that compresses to a Groth16 proof verifiable on Ethereum.

**Why RISC Zero (not circom / Noir / arithmetic circuits):** our proofs include EVM simulation, policy JSON parsing, and iterative ML comparison logic. These are prohibitively complex to write as arithmetic circuits. RISC Zero lets us write normal Rust, including crates like `alloy` and `ethers` (with deterministic builds).

## Three Circuits

1. **PolicyCompliance** — proves an action satisfies the current policy.
2. **CounterfactualCorrectness** — proves that Timeline B simulation was correct.
3. **LearningLoopCorrectness** — proves a policy update was earned (stretch goal).

Each circuit is a Rust crate in `zk/guest/<circuit-name>/`. Each has a host-side wrapper in `zk/host/src/<circuit-name>.rs` that:

- Prepares journal (public) inputs
- Invokes RISC Zero prover (local or Bonsai)
- Extracts seal (proof) and journal
- Returns Groth16-compressed proof + public inputs for on-chain verification

## Circuit 1 — PolicyCompliance

### What It Proves

Given:
- A machine-readable policy document `P` (JSON)
- A proposed action `A` (target address, calldata)
- A threat evidence object `E` (detection event details)

The proof attests: **`A` is an authorized response to `E` under policy `P`.**

### Guest Program (Rust)

```rust
// zk/guest/policy-compliance/src/main.rs
use risc0_zkvm::guest::env;
use sha2::{Digest, Sha256};

#[derive(serde::Deserialize)]
struct GuestInputs {
    policy_json: String,
    action: Action,
    evidence: Evidence,
}

#[derive(serde::Deserialize)]
struct Action {
    target: [u8; 20],
    selector: [u8; 4],
    calldata: Vec<u8>,
}

#[derive(serde::Deserialize)]
struct Evidence {
    event_id: [u8; 32],
    pattern: String,
    confidence: u16,  // basis points, 0-10000
    victim_protocol: [u8; 20],
}

fn main() {
    let inputs: GuestInputs = env::read();

    // 1. Parse policy
    let policy: Policy = serde_json::from_str(&inputs.policy_json).unwrap();

    // 2. Hash policy for journal (public input)
    let policy_hash = Sha256::digest(inputs.policy_json.as_bytes());

    // 3. Find rule matching evidence.pattern
    let rule = policy.rules.iter()
        .find(|r| r.pattern == inputs.evidence.pattern)
        .expect("no rule matches pattern");

    // 4. Check confidence floor
    assert!(inputs.evidence.confidence >= rule.min_confidence);

    // 5. Check action matches an authorized primitive
    let primitive = DefenseType::from_calldata(&inputs.action);
    assert!(rule.authorized_primitives.contains(&primitive));

    // 6. Check target is permitted (must be the victim protocol)
    assert_eq!(inputs.action.target, inputs.evidence.victim_protocol);

    // 7. Commit public inputs (journal)
    let action_hash = Sha256::digest(&[
        inputs.action.target.as_slice(),
        inputs.action.selector.as_slice(),
        &inputs.action.calldata,
    ].concat());

    env::commit(&action_hash.as_slice().to_vec());
    env::commit(&policy_hash.as_slice().to_vec());
    env::commit(&inputs.evidence.event_id.to_vec());
}
```

### Public Inputs (Journal)

Ordered:
1. `actionHash` (bytes32) — hash of the action being proven
2. `policyHash` (bytes32) — hash of the policy used
3. `eventId` (bytes32) — the threat event this action responds to

### Private Inputs

- Full policy document
- Full evidence object including any sensitive fields (attacker fingerprints, etc.)

### Verification On-Chain

`PolicyRegistry.verifyAndExecute()` calls `PolicyVerifier.verify(proof, publicInputs)`. If `publicInputs[1]` does not match `currentPolicyHash`, revert. Otherwise, if `verify` returns true, execute the action.

### Proving Time

- Local (dev): ~15–30s
- Bonsai: ~2–4s (target for MVP live path)
- Cache hit: <10ms

### Known Pitfalls

- **Policy JSON whitespace matters** — we hash the raw string. Canonicalize (sort keys, no whitespace) before hashing; enforce via shared util.
- **Numeric types** — `confidence` is u16 in basis points. Never floats across the host/guest boundary.

---

## Circuit 2 — CounterfactualCorrectness

### What It Proves

Given:
- A fork block number `N`
- A sequence of txs `T = [t1, t2, ...]` (Timeline B — the attacker's actions without defense)
- Final balances of tracked addresses `B = {(addr, balance), ...}`
- Pre-fork state root `R0`

The proof attests: **starting from state `R0`, executing `T` in order produces a state where tracked address balances equal `B`.**

### Why This Is Hard

Proving EVM execution inside RISC Zero is non-trivial. Two viable approaches:

**Approach A — Full REVM inside RISC Zero** (the clean approach, harder)
- Embed `revm` in the guest program.
- Reconstruct pre-state from a Merkle-Patricia proof of `R0`.
- Execute each tx, update state, verify final balances.
- Proof generation: ~30–60s per circuit run. Probably too slow for MVP live path; use caching.

**Approach B — Attested Simulation** (the pragmatic approach for MVP)
- Use a committee / signer-based attestation in addition to ZK. Have 3 independent verifiers each run the simulation with reproducible Anvil forks and sign the resulting merkle root. Proof is a threshold BLS signature over the root. Separately, a RISC Zero proof attests the attestation logic (signature verification) ran correctly.
- This is **not pure ZK**, but it is cryptographically auditable. It's honest to call it a "threshold-attested counterfactual."
- MVP demo language: "The counterfactual is verified by three independent simulators, bonded by signature, and recorded on-chain with a zero-knowledge compression of the attestation."

**Decision: go with Approach B for MVP, A as a documented follow-up.** Approach A is the right long-term story but too much for 24 hours even with strong devs. In the demo, call it "verifiable counterfactual" — do not say "ZK-proven full EVM re-execution" because it isn't.

If time permits, ship Approach A for one "hero" scenario with cached proof, and Approach B for the live flow. The on-chain `CounterfactualVerifier` can be a single verifier contract that internally dispatches to the right algorithm based on a leading byte of the proof.

### Guest Program (Approach B — Attested)

```rust
// zk/guest/counterfactual-correctness/src/main.rs
// Verifies: threshold signatures over (eventId, counterfactualRoot, deltaWei)
// are valid from ≥3 of M whitelisted simulator keys.

use risc0_zkvm::guest::env;
use bls12_381::{G1Affine, G2Affine, Scalar};
use bls_signatures::{PublicKey, Signature, verify};

fn main() {
    let inputs: GuestInputs = env::read();

    let msg = encode_packed(&[
        inputs.event_id.as_slice(),
        inputs.counterfactual_root.as_slice(),
        &inputs.delta_wei.to_be_bytes(),
        inputs.policy_hash.as_slice(),
    ]);

    let required: usize = 3;
    let mut valid_count = 0;
    for (sig, pk) in inputs.signatures.iter().zip(inputs.pubkeys.iter()) {
        if verify(sig, &msg, pk) {
            valid_count += 1;
        }
    }
    assert!(valid_count >= required);

    env::commit(&inputs.event_id.to_vec());
    env::commit(&inputs.counterfactual_root.to_vec());
    env::commit(&inputs.delta_wei.to_be_bytes().to_vec());
    env::commit(&inputs.policy_hash.to_vec());
}
```

### Public Inputs

1. `eventId` (bytes32)
2. `counterfactualRoot` (bytes32)
3. `deltaWei` (int256, encoded as bytes32)
4. `policyHash` (bytes32)

### Proving Time

BLS verification × 3–5: ~5–10s with Bonsai.

---

## Circuit 3 — LearningLoopCorrectness (Stretch)

### What It Proves

Given:
- Previous policy hash `P_old`
- New policy hash `P_new`
- Batch of N evaluation attacks `A = [a1, ..., aN]` with ground-truth outcomes
- Blue agent's actions on each attack under `P_new`
- Observed win rate `W`

The proof attests: **running `P_new` against attack batch `A` yields win rate ≥ `W`, and `W ≥ τ` (the required threshold), and `A` was not cherry-picked (it comes from a Merkle-committed eval set).**

### Approach

- Eval batch is committed to a merkle root published before the learning loop starts.
- Blue agent policy is a deterministic function (policy JSON → action given evidence).
- Guest runs: for each eval attack, compute Blue's action under `P_new`, compare to ground-truth "blocks attack" predicate, accumulate.
- Asserts win rate, commits public inputs.

### Status

**Out of hackathon scope.** We will show this as a pre-rendered visualization (Evolution Battlefield) backed by a real background loop, but we will not prove it live. A cached example proof may be displayed.

---

## Verifier Contract Generation

RISC Zero provides:

```bash
cargo risczero verify solidity --circuit policy-compliance > contracts/verifiers/generated/PolicyVerifier.sol
```

The generated contract is a Groth16 verifier with hardcoded trusted-setup parameters derived from the circuit's image ID. Do not hand-edit.

## Image IDs

Each compiled guest has a deterministic image ID (hash of the compiled ELF). The verifier contract checks that the proof was generated with the correct image ID. We pin image IDs in `/config/image-ids.json`:

```json
{
    "policy-compliance": "0x<32 bytes>",
    "counterfactual-correctness": "0x<32 bytes>"
}
```

Whenever the guest code changes, the image ID changes, and the verifier contract must be regenerated.

## Proving Infrastructure

### Bonsai (remote, preferred)

```bash
export BONSAI_API_URL=https://api.bonsai.xyz
export BONSAI_API_KEY=<key>
```

Host code transparently uses Bonsai when `PROVE_BACKEND=bonsai`.

### Local (fallback)

```bash
cargo run --release --bin host-policy-compliance
```

Requires CUDA for performant local proving. Without GPU, allow 60s+ per proof.

### Caching

Implemented in `zk-prover` service (see doc 03). Key: `sha256(input_json)`. Value: proof bytes + public inputs. Use this aggressively for demo scenarios.

## Critical: The Hackathon Reality

Generating three different proofs live in the demo window is risky. The demo playbook (doc 12) has the following strategy:

- **PolicyCompliance proof for defense action:** LIVE during demo. Falls back to cache on timeout.
- **PolicyCompliance proof for the Agent Constraint Failure demo:** LIVE. Must deterministically fail. Fast path since rejection is quick.
- **CounterfactualCorrectness proof:** PRE-COMPUTED for the demo scenario. Committed to the ledger during the live sequence using a pre-generated proof. We are honest about this: the underlying computation happens live, but the cryptographic sealing is cached.
- **LearningLoopCorrectness:** Visualization only; not live.

Any live-proved path must have a cache fallback. The circuit breaker is:

```typescript
const proof = await Promise.race([
    proveLive(input),
    delay(TIMEOUT).then(() => proveFromCache(input))
]);
```
