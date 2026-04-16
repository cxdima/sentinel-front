# 02 — Smart Contracts Specification

All contracts target **Solidity 0.8.24**, compiled with via-IR and optimizer runs=200. Foundry is the build tool.

## Contract Overview

| Contract | Purpose | Who Can Call |
|----------|---------|--------------|
| `PolicyRegistry` | Stores current policy hash; gates all defense actions | Defense agent (gated) |
| `PolicyVerifier` | Verifies ZK proof that an action is policy-compliant | `PolicyRegistry` |
| `LearningVerifier` | Verifies ZK proof that a policy update was earned via adversarial loop | `PolicyRegistry` |
| `CounterfactualLedger` | Immutable record of counterfactual proofs | Prover service |
| `CounterfactualVerifier` | Verifies ZK proof of simulation correctness | `CounterfactualLedger` |
| `ThreatRegistry` | Anonymized threat signatures for cross-protocol immunity | SENTINEL operator |
| `PauseController` | Emergency pause for protected protocols | Defense agent (gated by `PolicyRegistry`) |
| `QuarantineVault` | Time-locked vault for quarantined funds | `PauseController` |
| `SentinelGuard` | Integration surface for protected protocols | Protected protocols |
| `VictimLendingPool` | Demo victim protocol (for hackathon) | Anyone |

---

## `PolicyRegistry.sol`

The authority for what actions the defense agent may take. All defense txs pass through here.

### Storage

```solidity
bytes32 public currentPolicyHash;      // hash of current policy document (IPFS CID)
uint256 public policyVersion;          // monotonic
address public policyVerifier;         // PolicyVerifier contract
address public learningVerifier;       // LearningVerifier contract
address public defenseAgent;           // the agent's authorized signer address
mapping(uint256 => bytes32) public policyHashByVersion;
```

### Events

```solidity
event PolicyInitialized(bytes32 indexed policyHash, uint256 version);
event PolicyUpdated(bytes32 indexed oldHash, bytes32 indexed newHash, uint256 version);
event ActionExecuted(bytes32 indexed actionHash, address indexed target, bytes4 selector, uint256 block);
event ActionRejected(bytes32 indexed actionHash, string reason);
```

### Functions

```solidity
function initialize(bytes32 policyHash, address agent) external onlyOwner;

function verifyAndExecute(
    address target,
    bytes calldata action,           // calldata for target
    bytes calldata proof,            // ZK proof bytes
    bytes32[] calldata publicInputs  // [actionHash, policyHash, eventId]
) external returns (bool success);

function updatePolicy(
    bytes32 newPolicyHash,
    bytes calldata learningProof,
    bytes32[] calldata publicInputs  // [oldHash, newHash, winRate, eventBatchRoot]
) external;
```

### Invariants

- `msg.sender == defenseAgent` for `verifyAndExecute`.
- `publicInputs[1] == currentPolicyHash` — no stale policy invocations.
- `PolicyVerifier.verify(proof, publicInputs) == true` — policy proof must validate.
- `updatePolicy` requires `publicInputs[0] == currentPolicyHash` and a valid learning proof.
- Both `verifyAndExecute` and `updatePolicy` revert on any failure; no partial state writes.

### Gas Targets

- `verifyAndExecute` (with Groth16 verify): ~280k gas.
- `updatePolicy`: ~320k gas.

---

## `CounterfactualLedger.sol`

Writes the outcome of the dual-timeline simulation to the chain.

### Storage

```solidity
struct Entry {
    bytes32 eventId;             // unique per detection event
    uint256 atBlock;             // block number where divergence occurred
    int256 deltaWei;             // Timeline B loss - Timeline A loss (negative if defense failed, positive if succeeded)
    bytes32 realTxHash;          // Timeline A (actual) defense tx
    bytes32 counterfactualRoot;  // merkle root of Timeline B full state diff
    bytes32 proofDigest;         // hash of the ZK proof
    uint256 recordedAt;
}

mapping(bytes32 => Entry) public entries;
bytes32[] public eventIds;
address public counterfactualVerifier;
address public prover;             // service address authorized to publish
```

### Events

```solidity
event CounterfactualRecorded(
    bytes32 indexed eventId,
    int256 deltaWei,
    uint256 atBlock,
    bytes32 proofDigest
);
```

### Functions

```solidity
function record(
    Entry calldata entry,
    bytes calldata proof,
    bytes32[] calldata publicInputs  // [eventId, counterfactualRoot, deltaWei, policyHash]
) external;

function getEntry(bytes32 eventId) external view returns (Entry memory);
function getEntryCount() external view returns (uint256);
function getEntryAt(uint256 index) external view returns (Entry memory);
```

### Invariants

- `msg.sender == prover`.
- `entries[entry.eventId].eventId == bytes32(0)` — no overwrites, ever.
- `CounterfactualVerifier.verify(proof, publicInputs) == true`.
- Public inputs must match stored entry fields.

### Gas

- `record`: ~260k gas including Groth16 verify.

---

## `PolicyVerifier.sol`, `LearningVerifier.sol`, `CounterfactualVerifier.sol`

Each is a Groth16 verifier generated from the corresponding RISC Zero circuit via `bonsai-cli export-solidity-verifier`. They are single-function contracts:

```solidity
contract PolicyVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
```

Do not modify the generated verifier files. Put them in `contracts/verifiers/generated/` and treat as read-only.

---

## `ThreatRegistry.sol`

Anonymized threat signatures for ecosystem-wide immunity propagation.

### Storage

```solidity
struct Signature {
    bytes32 signatureHash;    // fingerprint of the attack pattern
    bytes32 defensePrimitive; // enum: pause / quarantine / rate_limit / circuit_breaker / unwind
    uint16 confidence;        // 0-10000 (bp)
    bytes32 derivationProof;  // hash of ZK proof that sig was derived from real event
    uint256 publishedAt;
}

mapping(bytes32 => Signature) public signatures;
bytes32[] public signatureHashes;
```

### Events

```solidity
event SignaturePublished(bytes32 indexed signatureHash, bytes32 defensePrimitive, uint16 confidence);
```

### Functions

```solidity
function publish(Signature calldata sig) external onlyOperator;
function get(bytes32 signatureHash) external view returns (Signature memory);
function getAll() external view returns (bytes32[] memory);
```

**Hackathon MVP note:** This contract exists but is populated from pre-generated signatures during demo. Live publication is stretch.

---

## `PauseController.sol` + `QuarantineVault.sol`

### `PauseController`

```solidity
enum DefenseType { None, Pause, Quarantine, RateLimit, CircuitBreaker, Unwind }

struct Defense {
    DefenseType defenseType;
    address target;
    bytes32 eventId;
    uint256 activatedAt;
    bool active;
}

mapping(address => Defense) public activeDefense; // by protected protocol

function activate(address target, DefenseType t, bytes32 eventId) external onlyPolicyRegistry;
function deactivate(address target) external onlyGovernance;
```

### `QuarantineVault`

```solidity
struct Quarantine {
    address originProtocol;
    uint256 amount;
    address token;
    uint256 releaseTime;  // activatedAt + 72h
}

mapping(bytes32 => Quarantine) public quarantines; // by eventId

function deposit(bytes32 eventId, address token, uint256 amount, address origin) external onlyPauseController;
function release(bytes32 eventId) external; // callable by anyone after releaseTime
```

Invariant: funds may only be released to `originProtocol` and only after `releaseTime`.

---

## `SentinelGuard.sol`

The integration point for protected protocols. Exposes a single read function:

```solidity
function isAllowed(address caller, bytes4 selector) external view returns (bool);
```

Internally reads from `PauseController.activeDefense[msg.sender]` and the protocol-specific allowlist.

Protected protocols add this modifier:

```solidity
modifier sentinelProtected() {
    require(
        SentinelGuard(SENTINEL).isAllowed(msg.sender, msg.sig),
        "SENTINEL: halted"
    );
    _;
}
```

---

## `VictimLendingPool.sol` (demo protocol)

A deliberately vulnerable lending pool for the demo. It has:

- A USDC/ETH pool with a naive price oracle (spot from a single Uniswap V2 pair).
- `borrow()` function that accepts the spot price without TWAP.
- Integrated with `SentinelGuard` via the `sentinelProtected` modifier.

The flash loan attack:
1. Attacker borrows 10M USDC from a flash loan provider.
2. Dumps USDC into the oracle pair, crashing the ETH price.
3. Calls `borrow()` on `VictimLendingPool` and drains it at the manipulated price.
4. Repays the flash loan.

The defense: SENTINEL detects step 2 in the mempool, executes `PauseController.activate(VictimLendingPool, Pause, eventId)` before step 3 can confirm.

Full attack contract at `contracts/demo/FlashLoanAttacker.sol`. Reference implementation included.

---

## Deployment Order

```
1. PolicyVerifier, LearningVerifier, CounterfactualVerifier   (generated)
2. PolicyRegistry (wire in PolicyVerifier, LearningVerifier)
3. CounterfactualLedger (wire in CounterfactualVerifier)
4. ThreatRegistry
5. QuarantineVault (deploy paused)
6. PauseController (wire in PolicyRegistry, QuarantineVault)
7. SentinelGuard (wire in PauseController)
8. VictimLendingPool (wire in SentinelGuard)
9. FlashLoanAttacker (test only)
10. PolicyRegistry.initialize(policyHash, defenseAgentAddr)
11. Seed demo state: mint USDC to attacker, fund lending pool, warm up oracle
```

Script at `script/DeployLocal.s.sol`. Run via `forge script --rpc-url http://localhost:8545 --broadcast`.

## Addresses (Local Anvil)

Deterministic deployment using `CREATE2` with fixed salts. Addresses are pinned in `/config/addresses.local.json`:

```json
{
  "PolicyRegistry":          "0x...",
  "CounterfactualLedger":    "0x...",
  "PauseController":         "0x...",
  "QuarantineVault":         "0x...",
  "ThreatRegistry":          "0x...",
  "SentinelGuard":           "0x...",
  "VictimLendingPool":       "0x...",
  "PolicyVerifier":          "0x...",
  "LearningVerifier":        "0x...",
  "CounterfactualVerifier":  "0x..."
}
```

All services load addresses from this file. Never hardcode in source.

## Testing (brief; full plan in doc 11)

- Unit tests: every function, revert paths for every invariant.
- Fork tests: use Foundry's fork cheats to replay historical exploits (Euler Finance block 16817996) and verify detection fires.
- Integration tests: full end-to-end scenario in `test/e2e/FlashLoanDefense.t.sol`.
- Gas tests: assert all gas targets above are within ±5%.
