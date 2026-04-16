# 11 — Testing Strategy

The demo succeeds only if the system is reliable under the specific conditions of the pitch (one scenario, one attack, one sequence, running on a laptop). Our tests are aimed squarely at that.

## Test Layers

1. **Unit tests** — every contract function, every service module.
2. **Integration tests** — pairs of services communicating through Redis.
3. **End-to-end tests** — full scenario from attacker tx to on-chain ledger record.
4. **Soak tests** — 100 consecutive scenario replays, look for race conditions.
5. **Dry-run demos** — the actual 90-second demo, 10 consecutive clean runs.

Tests in higher layers do not replace lower layers. All must pass.

## Smart Contract Tests (Foundry)

### Coverage Targets

Every contract in `contracts/src/` has a corresponding `test/ContractName.t.sol`. Branch coverage target: **> 90%**.

### Key Test Cases

**`PolicyRegistry.t.sol`:**
- `test_verifyAndExecute_happyPath_executesTarget`
- `test_verifyAndExecute_revertsOnInvalidProof`
- `test_verifyAndExecute_revertsOnStalePolicyHash`
- `test_verifyAndExecute_revertsWhenCallerNotAgent`
- `test_updatePolicy_happyPath_updatesHash`
- `test_updatePolicy_revertsOnInvalidLearningProof`
- `test_updatePolicy_revertsOnStaleOldPolicyHash`

**`CounterfactualLedger.t.sol`:**
- `test_record_happyPath_storesEntry`
- `test_record_revertsOnInvalidProof`
- `test_record_revertsOnDuplicateEventId`
- `test_record_revertsWhenCallerNotProver`
- `test_getEntry_returnsZeroedForMissing`

**`PauseController.t.sol`:**
- `test_activate_setsDefense`
- `test_activate_revertsWhenNotAuthorized`
- `test_deactivate_resetsDefense`

**`VictimLendingPool.t.sol` (integration):**
- `test_normalBorrow_succeeds`
- `test_whenPaused_borrowReverts`
- `test_flashLoanAttackWithoutSentinel_drainsPool`  ← critical; proves the attack works
- `test_flashLoanAttackWithSentinel_poolUntouched`  ← critical; proves defense works

### Fuzz Tests

- `PolicyRegistry.verifyAndExecute` with random calldata + random proofs → must always revert unless proof is valid.
- `CounterfactualLedger.record` with random entries + proofs → invariant: no duplicate eventIds ever stored.

### Invariant Tests

- Sum of quarantined funds across all events == balance of `QuarantineVault`.
- `PolicyRegistry.currentPolicyHash` == `policyHashByVersion[policyVersion]` always.

### Running

```bash
cd contracts
forge test -vvv                    # full verbosity
forge test --match-contract PolicyRegistry
forge coverage --report summary
forge invariant --match-test invariant_ledgerEventIdsUnique
```

### Gas Benchmarks

`forge snapshot` produces `.gas-snapshot`. CI fails if regressions > 5%. Values:

- `verifyAndExecute`: ~280k gas
- `CounterfactualLedger.record`: ~260k gas
- `PauseController.activate`: ~45k gas

## TypeScript Service Tests (Vitest)

Per service, `tests/*.spec.ts`:

**mempool-monitor:**
- Feature extraction correctness with canned tx samples
- Selector lookup via ABI decoder
- Redis publishing with mocked Redis

**counterfactual-sim:**
- Anvil fork spawn + teardown
- Deterministic replay of a recorded attack produces expected final balances
- Delta computation correctness

**api-gateway:**
- Every REST endpoint with mocked upstream services
- WebSocket connection lifecycle (hello / subscribe / unsub / ping)
- Event routing from Redis to WS

Run:

```bash
pnpm test          # all services
pnpm --filter mempool-monitor test
```

## Python Service Tests (pytest)

**detection-engine:**
- State machine transitions with canned event sequences
- Confidence calculations
- Pattern classifier against stored feature fixtures

**defense-agent:**
- Policy lookup for each attack pattern returns correct primitive
- Proof request handling (success / timeout / rejection)
- Tx construction and signing correctness
- Agent Constraint Failure path — proof request fails as expected

Run:

```bash
cd services/detection-engine && poetry run pytest
```

## ZK Tests

### Circuit Tests

Per guest program, a host-side test:

```rust
// zk/host/tests/policy_compliance.rs
#[test]
fn test_policy_compliance_happy_path() {
    let inputs = GuestInputs { /* valid */ };
    let receipt = prove(&POLICY_COMPLIANCE_ELF, inputs).unwrap();
    let public_inputs = receipt.journal.decode();
    assert_eq!(public_inputs.action_hash, expected_hash);
}

#[test]
#[should_panic]
fn test_policy_compliance_rejects_unmatched_pattern() {
    let inputs = GuestInputs { /* pattern with no rule */ };
    prove(&POLICY_COMPLIANCE_ELF, inputs).unwrap();  // should panic in guest
}

#[test]
fn test_policy_compliance_rejects_low_confidence() {
    let inputs = GuestInputs { /* confidence below floor */ };
    assert!(prove(&POLICY_COMPLIANCE_ELF, inputs).is_err());
}
```

### On-chain Verifier Tests

`test/ZkVerifierIntegration.t.sol`:
- Generate proof locally (tests use `dev-mode` for speed)
- Call the on-chain verifier
- Assert returns true for valid, false for tampered

## Integration Tests

`test/e2e/FlashLoanDefense.t.sol`:

```solidity
function test_flashLoanAttack_withSentinel_isDefended() public {
    // 1. Deploy all contracts (via deployAll helper)
    // 2. Seed demo state: fund attacker, warm pool
    // 3. Simulate detection event (inject directly via helper since mempool isn't running in forge)
    // 4. Call PolicyRegistry.verifyAndExecute with valid proof (fixture)
    // 5. Assert PauseController.activeDefense[pool].active == true
    // 6. Execute attacker's exploit tx
    // 7. Assert revert
    // 8. Assert pool balance unchanged
}
```

Live integration tests run outside Foundry:

```bash
./scripts/test-e2e.sh
```

Which:
1. Boots docker-compose stack
2. Seeds demo state
3. Triggers attacker
4. Asserts full pipeline responded correctly
5. Tears down

## Soak Tests

Pre-demo ritual:

```bash
for i in {1..100}; do
    ./scripts/reset.sh
    ./scripts/seed-demo-state.sh
    ./scripts/replay-scenario.sh flash-loan-oracle
    if [ $? -ne 0 ]; then
        echo "FAILED at iteration $i"; exit 1
    fi
done
```

If this passes, the demo will work.

## Dry-Run Demos

Final quality gate before pitch:

1. Reset to clean state.
2. Run the demo exactly as described in doc 12.
3. Time it end-to-end.
4. Record screen.
5. Do this 10 times in a row.
6. Keep one recording as the "works for sure" backup if live demo fails.

## Test Data Fixtures

Stored in `test/fixtures/`:

- `pending-tx-flashloan.json` — sample pending tx for FL origination
- `pending-tx-oracle-manip.json` — sample pending tx for oracle manipulation
- `policy-v1.json` — the MVP policy document
- `threat-event-confirmed.json` — sample confirmed threat
- `anvil-prestate.json` — fully-seeded pre-attack state
- `cached-proofs/` — pre-generated ZK proofs for demo

## CI

GitHub Actions runs:
1. All Foundry tests (`forge test`)
2. All pnpm tests (`pnpm test`)
3. All poetry tests (`poetry run pytest`)
4. Rust tests (`cargo test --release`)
5. One scripted e2e (docker compose up, run one scenario, assert outcome, tear down)

Target: all green in < 10 minutes.

## Not Testing (Explicit)

- Load testing above 10 concurrent events (out of scope for MVP)
- Mainnet forks (we use our own Anvil)
- Cross-chain flows (single chain for MVP)
- Adversarial input to API gateway (no production auth anyway)

## Demo-Breaking Bugs to Watch For

Prioritize finding these during testing:

1. **Intermittent detection false negatives** — if the detection engine misses the attack even 1 in 10 times, the demo will break. Fixed seeds + pre-scripted scenarios mitigate.
2. **Anvil mempool dropping pending txs** — Anvil's default behavior may evict pending txs after block time. Pin block time high enough to catch them.
3. **Time-of-day effects** — Bonsai latency varies. Always have cached fallback.
4. **Browser WebSocket buffer overflow** — with dense visualizations, the WS stream can overwhelm the browser. Apply per-channel throttling at api-gateway.
