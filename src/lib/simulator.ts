/**
 * Simulated event generator for the War Demo Room.
 *
 * Emits EventEnvelopes shaped identically to the api-gateway firehose so the
 * UI can't tell the difference between live and simulated. Used as the demo's
 * fallback when the backend is unreachable, and also on explicit user request.
 *
 * Each scenario plays a fixed attack narrative end-to-end with realistic
 * inter-stage delays (mempool → detection → defense → proof → ledger).
 */
import type { EventEnvelope } from "./ws";

export type Scenario =
    | "flash-loan"
    | "preemptive"
    | "inject-instruction"
    | "blitz"
    | "recon"
    | "stealth"
    | "sandwich"
    | "pingflood"
    | "dust"
    | "reentrant"
    | "routine";

/** Scenarios backed by `demo/attacker.py` — dispatched via the generic
 *  `/api/v1/demo/scenario/:name` endpoint rather than bespoke API routes. */
export const ATTACKER_SCENARIOS: ReadonlySet<Scenario> = new Set([
    "blitz",
    "recon",
    "stealth",
    "sandwich",
    "pingflood",
    "dust",
    "reentrant",
    "routine",
]);

export interface ScenarioMeta {
    id: Scenario;
    label: string;
    description: string;
    pattern: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "BENIGN";
    estMs: number;
}

export const SCENARIOS: ScenarioMeta[] = [
    {
        id: "flash-loan",
        label: "FLASH LOAN ORACLE MANIP",
        description: "Borrow 900 WETH, slam oracle, drain victim pool. Mempool detection → defense in same block.",
        pattern: "FLASH_LOAN_ORACLE_MANIP",
        severity: "CRITICAL",
        estMs: 3200,
    },
    {
        id: "preemptive",
        label: "PREEMPTIVE STRIKE",
        description: "Cross-federation signature arrives before attack lands. Pause propagates to 12 peer protocols.",
        pattern: "FLASH_LOAN_ORACLE_MANIP",
        severity: "CRITICAL",
        estMs: 3800,
    },
    {
        id: "inject-instruction",
        label: "OPERATOR OVERRIDE",
        description: "Unknown-pattern injection. Tests policy-compliance verifier under adversarial conditions.",
        pattern: "OPERATOR_OVERRIDE",
        severity: "HIGH",
        estMs: 2400,
    },
    {
        id: "blitz",
        label: "BLITZ · OP-7741",
        description: "Loud textbook flash-loan oracle manipulation. Four stages, max drama, every signal lights.",
        pattern: "FLASH_LOAN_ORACLE_MANIP",
        severity: "CRITICAL",
        estMs: 20000,
    },
    {
        id: "recon",
        label: "RECON · OP-2319",
        description: "Patient intel gathering: sybil probes, nudge swap, then the slam. Eight correlated signals.",
        pattern: "FLASH_LOAN_ORACLE_MANIP",
        severity: "CRITICAL",
        estMs: 40000,
    },
    {
        id: "stealth",
        label: "STEALTH · OP-0404",
        description: "Surgical direct exploit. One cold attack(address,uint256) call. Loses on selector alone.",
        pattern: "DIRECT_EXPLOIT",
        severity: "HIGH",
        estMs: 10000,
    },
    {
        id: "sandwich",
        label: "SANDWICH · OP-MEV1",
        description: "MEV front-run → victim swap → back-run around an oracle pair. Extracts slippage.",
        pattern: "MEV_SANDWICH",
        severity: "HIGH",
        estMs: 15000,
    },
    {
        id: "pingflood",
        label: "PING FLOOD · OP-PF22",
        description: "18 rapid micro-swaps to bias TWAP before the exploit. Cadence-based anomaly.",
        pattern: "ORACLE_PING_FLOOD",
        severity: "HIGH",
        estMs: 25000,
    },
    {
        id: "dust",
        label: "DUST STORM · OP-DS08",
        description: "25 dust transfers to poison anomaly distribution. Selector still fires on the exploit.",
        pattern: "DUST_EVASION",
        severity: "MEDIUM",
        estMs: 30000,
    },
    {
        id: "reentrant",
        label: "REENTRANT · OP-RX13",
        description: "Seed deposit + 6 rapid borrow() callbacks. Selector-repetition anomaly + exploit.",
        pattern: "REENTRANCY_DRAIN",
        severity: "HIGH",
        estMs: 12000,
    },
    {
        id: "routine",
        label: "ROUTINE · OP-BN00",
        description: "Benign baseline: deposit + small swap + transfer. No exploit. Detector should stay idle.",
        pattern: "BENIGN",
        severity: "BENIGN",
        estMs: 8000,
    },
];

type Emit = (env: EventEnvelope) => void;

function randHex(bytes: number): string {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return "0x" + Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randEventId(): string {
    return randHex(32);
}

function randTxHash(): string {
    return randHex(32);
}

function randAddr(): string {
    return randHex(20);
}

function env(channel: string, kind: string, data: Record<string, unknown>): EventEnvelope {
    return {
        channel,
        messageId: crypto.randomUUID(),
        emittedAt: new Date().toISOString(),
        kind,
        data,
    };
}

const FLASH_LOAN_PROVIDER = "0xfC00face00000000000000000000000000000000";
const VICTIM_POOL = "0xVict1m00000000000000000000000000000000aa";
const ATTACKER = "0xAttacker0000000000000000000000000000dead";

/**
 * Play a single scenario end-to-end. Returns a cancel fn.
 * All emissions go through `emit`; nothing else touches shared state.
 */
export function playScenario(scenario: Scenario, emit: Emit, startBlock: number): () => void {
    let cancelled = false;
    const timers: number[] = [];
    const schedule = (ms: number, fn: () => void) => {
        const id = window.setTimeout(() => {
            if (!cancelled) fn();
        }, ms);
        timers.push(id);
    };

    const eventId = randEventId();
    const attackerTx = randTxHash();
    const defenseTx = randTxHash();
    const proofDigest = randHex(32);
    const cfRoot = randHex(32);
    const block = startBlock;

    if (scenario === "flash-loan") {
        // Stage 1: mempool sees attacker tx
        schedule(0, () =>
            emit(
                env("sentinel.mempool.pending", "PENDING_TX", {
                    txHash: attackerTx,
                    from: ATTACKER,
                    to: FLASHLOAN_PROVIDER(),
                    selector: "0xab9c4b5d",
                    gasPrice: "45",
                    valueWei: (900n * 10n ** 18n).toString(),
                }),
            ),
        );

        // Stage 2: detection engine flags candidate (~80ms later)
        schedule(80, () =>
            emit(
                env("sentinel.detection.candidate", "THREAT_CANDIDATE", {
                    eventId,
                    pattern: "FLASH_LOAN_ORACLE_MANIP",
                    confidence: 7200,
                    triggeringTxHashes: [attackerTx],
                    victimProtocol: VICTIM_POOL,
                }),
            ),
        );

        // Stage 3: confirmation (~140ms)
        schedule(140, () =>
            emit(
                env("sentinel.detection.confirmed", "THREAT_CONFIRMED", {
                    eventId,
                    pattern: "FLASH_LOAN_ORACLE_MANIP",
                    confidence: 9800,
                    attackerAddresses: [ATTACKER],
                    triggeringTxHashes: [attackerTx],
                    victimProtocol: VICTIM_POOL,
                    observedAtBlock: block,
                    timestamp: new Date().toISOString(),
                }),
            ),
        );

        // Stage 4: counterfactual sim ready (~320ms)
        schedule(320, () =>
            emit(
                env("sentinel.counterfactual.ready", "COUNTERFACTUAL_READY", {
                    eventId,
                    counterfactualRoot: cfRoot,
                    damagePrevented: "2400000000000000000000000", // $2.4M in wei-equivalent
                    leaves: Array.from({ length: 8 }, () => randHex(32)),
                }),
            ),
        );

        // Stage 5: prover started (~340ms)
        schedule(340, () =>
            emit(
                env("sentinel.prover.started", "PROVER_STARTED", {
                    eventId,
                    circuit: "PolicyCompliance",
                }),
            ),
        );

        // Stage 6: defense tx submitted (~380ms — same block!)
        schedule(380, () =>
            emit(
                env("sentinel.defense.submitted", "DEFENSE_SUBMITTED", {
                    eventId,
                    txHash: defenseTx,
                    proofDigest,
                    target: VICTIM_POOL,
                    action: "PAUSE",
                }),
            ),
        );

        // Stage 7: prover finished
        schedule(1200, () =>
            emit(
                env("sentinel.prover.finished", "PROVER_FINISHED", {
                    eventId,
                    circuit: "PolicyCompliance",
                    gasUsed: 187340,
                    proofDigest,
                }),
            ),
        );

        // Stage 8: defense mined (~1.9s — next block after submission)
        schedule(1900, () =>
            emit(
                env("sentinel.defense.mined", "DEFENSE_MINED", {
                    eventId,
                    txHash: defenseTx,
                    blockNumber: block,
                    proofDigest,
                }),
            ),
        );

        // Stage 9: ledger recorded
        schedule(2400, () =>
            emit(
                env("sentinel.ledger.recorded", "LEDGER_RECORDED", {
                    eventId,
                    txHash: randTxHash(),
                    counterfactualRoot: cfRoot,
                    damagePrevented: "2400000000000000000000000",
                }),
            ),
        );

        // Stage 10: alert
        schedule(2500, () =>
            emit(
                env("sentinel.alerts", "ALERT", {
                    severity: "info",
                    message: `[sim] flash-loan attack neutralized · event ${eventId.slice(0, 10)}…`,
                    eventId,
                }),
            ),
        );
    }

    if (scenario === "preemptive") {
        // Signature propagates across the federation BEFORE the attack lands.
        schedule(0, () =>
            emit(
                env("sentinel.preemptive.signature", "PREEMPTIVE_SIGNATURE", {
                    eventId,
                    pattern: "FLASH_LOAN_ORACLE_MANIP",
                    peers: 12,
                    source: "aave-federation",
                }),
            ),
        );
        [0, 1, 2, 3, 4, 5].forEach((i) =>
            schedule(120 + i * 110, () =>
                emit(
                    env("sentinel.federation.sync", "FEDERATION_SYNC", {
                        eventId,
                        peer: ["Aave", "Compound", "Uniswap", "Curve", "Maker", "Lido"][i],
                        pattern: "FLASH_LOAN_ORACLE_MANIP",
                    }),
                ),
            ),
        );

        schedule(900, () =>
            emit(
                env("sentinel.preemptive.alert", "PREEMPTIVE_ALERT", {
                    eventId,
                    pattern: "FLASH_LOAN_ORACLE_MANIP",
                    protocolsShielded: 12,
                }),
            ),
        );

        schedule(1100, () =>
            emit(
                env("sentinel.mempool.pending", "PENDING_TX", {
                    txHash: attackerTx,
                    from: ATTACKER,
                    to: FLASHLOAN_PROVIDER(),
                    selector: "0xab9c4b5d",
                    gasPrice: "45",
                }),
            ),
        );

        schedule(1180, () =>
            emit(
                env("sentinel.detection.confirmed", "THREAT_CONFIRMED", {
                    eventId,
                    pattern: "FLASH_LOAN_ORACLE_MANIP",
                    confidence: 9900,
                    attackerAddresses: [ATTACKER],
                    triggeringTxHashes: [attackerTx],
                    victimProtocol: VICTIM_POOL,
                    observedAtBlock: block,
                    note: "signature prematch",
                }),
            ),
        );

        schedule(1320, () =>
            emit(
                env("sentinel.defense.submitted", "DEFENSE_SUBMITTED", {
                    eventId,
                    txHash: defenseTx,
                    proofDigest,
                    target: VICTIM_POOL,
                    action: "PAUSE",
                }),
            ),
        );

        schedule(1500, () =>
            emit(
                env("sentinel.preemptive.executed", "PREEMPTIVE_EXECUTED", {
                    eventId,
                    pattern: "FLASH_LOAN_ORACLE_MANIP",
                    protocolsShielded: 12,
                }),
            ),
        );

        schedule(2800, () =>
            emit(
                env("sentinel.defense.mined", "DEFENSE_MINED", {
                    eventId,
                    txHash: defenseTx,
                    blockNumber: block,
                    proofDigest,
                }),
            ),
        );

        schedule(3200, () =>
            emit(
                env("sentinel.ledger.recorded", "LEDGER_RECORDED", {
                    eventId,
                    txHash: randTxHash(),
                    counterfactualRoot: cfRoot,
                    damagePrevented: "5100000000000000000000000",
                }),
            ),
        );
    }

    // New attacker.py-backed scenarios. They all end in a confirmed threat
    // (except `routine` which stays at noise). Choreography is compressed vs.
    // real runtimes — the UI sim is always faster than the terminal demo.
    const attackScenarios: Record<
        string,
        { pattern: string; confidence: number; damage: string; anomaly: number; sequence: number } | null
    > = {
        blitz: {
            pattern: "FLASH_LOAN_ORACLE_MANIP",
            confidence: 9800,
            damage: "2400000000000000000000000",
            anomaly: 0.94,
            sequence: 0.91,
        },
        recon: {
            pattern: "FLASH_LOAN_ORACLE_MANIP",
            confidence: 9600,
            damage: "5100000000000000000000000",
            anomaly: 0.87,
            sequence: 0.93,
        },
        stealth: {
            pattern: "DIRECT_EXPLOIT",
            confidence: 9000,
            damage: "700000000000000000000000",
            anomaly: 0.62,
            sequence: 0.55,
        },
        sandwich: {
            pattern: "MEV_SANDWICH",
            confidence: 8700,
            damage: "180000000000000000000000",
            anomaly: 0.71,
            sequence: 0.78,
        },
        pingflood: {
            pattern: "ORACLE_PING_FLOOD",
            confidence: 9200,
            damage: "1300000000000000000000000",
            anomaly: 0.83,
            sequence: 0.88,
        },
        dust: {
            pattern: "DUST_EVASION",
            confidence: 8900,
            damage: "960000000000000000000000",
            anomaly: 0.74,
            sequence: 0.69,
        },
        reentrant: {
            pattern: "REENTRANCY_DRAIN",
            confidence: 9400,
            damage: "1800000000000000000000000",
            anomaly: 0.88,
            sequence: 0.81,
        },
        routine: null,
    };

    if (scenario in attackScenarios) {
        const meta = attackScenarios[scenario];
        if (meta === null) {
            // routine: benign baseline — mempool chatter, nothing confirms.
            schedule(0, () =>
                emit(
                    env("sentinel.mempool.pending", "PENDING_TX", {
                        txHash: randTxHash(),
                        from: ATTACKER,
                        to: VICTIM_POOL,
                        selector: "0xb6b55f25",
                        gasPrice: "23",
                    }),
                ),
            );
            schedule(900, () =>
                emit(
                    env("sentinel.mempool.pending", "PENDING_TX", {
                        txHash: randTxHash(),
                        from: ATTACKER,
                        to: randAddr(),
                        selector: "0xd004f0f7",
                        gasPrice: "24",
                    }),
                ),
            );
            schedule(1800, () =>
                emit(
                    env("sentinel.mempool.pending", "PENDING_TX", {
                        txHash: randTxHash(),
                        from: ATTACKER,
                        to: randAddr(),
                        selector: "0xa9059cbb",
                        gasPrice: "22",
                    }),
                ),
            );
            schedule(2400, () =>
                emit(
                    env("sentinel.alerts", "ALERT", {
                        severity: "info",
                        message: `[sim] routine activity · detector stayed idle`,
                    }),
                ),
            );
            return () => {
                cancelled = true;
                for (const t of timers) clearTimeout(t);
            };
        }

        // Rough shared choreography for attack scenarios.
        schedule(0, () =>
            emit(
                env("sentinel.mempool.pending", "PENDING_TX", {
                    txHash: attackerTx,
                    from: ATTACKER,
                    to: FLASHLOAN_PROVIDER(),
                    selector: "0xab9c4b5d",
                    gasPrice: "45",
                }),
            ),
        );
        schedule(120, () =>
            emit(
                env("sentinel.detection.candidate", "THREAT_CANDIDATE", {
                    eventId,
                    pattern: meta.pattern,
                    confidence: Math.max(meta.confidence - 2500, 1000),
                    triggeringTxHashes: [attackerTx],
                    victimProtocol: VICTIM_POOL,
                    anomalyScore: meta.anomaly - 0.1,
                    sequenceScore: meta.sequence - 0.15,
                }),
            ),
        );
        schedule(300, () =>
            emit(
                env("sentinel.detection.confirmed", "THREAT_CONFIRMED", {
                    eventId,
                    pattern: meta.pattern,
                    confidence: meta.confidence,
                    attackerAddresses: [ATTACKER],
                    triggeringTxHashes: [attackerTx],
                    victimProtocol: VICTIM_POOL,
                    observedAtBlock: block,
                    anomalyScore: meta.anomaly,
                    sequenceScore: meta.sequence,
                    timestamp: new Date().toISOString(),
                }),
            ),
        );
        schedule(480, () =>
            emit(
                env("sentinel.counterfactual.ready", "COUNTERFACTUAL_READY", {
                    eventId,
                    counterfactualRoot: cfRoot,
                    damagePrevented: meta.damage,
                    leaves: Array.from({ length: 8 }, () => randHex(32)),
                }),
            ),
        );
        schedule(520, () =>
            emit(
                env("sentinel.prover.started", "PROVER_STARTED", {
                    eventId,
                    circuit: "PolicyCompliance",
                }),
            ),
        );
        schedule(620, () =>
            emit(
                env("sentinel.defense.submitted", "DEFENSE_SUBMITTED", {
                    eventId,
                    txHash: defenseTx,
                    proofDigest,
                    target: VICTIM_POOL,
                    action: "PAUSE",
                }),
            ),
        );
        schedule(1400, () =>
            emit(
                env("sentinel.prover.finished", "PROVER_FINISHED", {
                    eventId,
                    circuit: "PolicyCompliance",
                    gasUsed: 187340,
                    proofDigest,
                }),
            ),
        );
        schedule(2000, () =>
            emit(
                env("sentinel.defense.mined", "DEFENSE_MINED", {
                    eventId,
                    txHash: defenseTx,
                    blockNumber: block,
                    proofDigest,
                }),
            ),
        );
        schedule(2600, () =>
            emit(
                env("sentinel.ledger.recorded", "LEDGER_RECORDED", {
                    eventId,
                    txHash: randTxHash(),
                    counterfactualRoot: cfRoot,
                    damagePrevented: meta.damage,
                }),
            ),
        );
        schedule(2700, () =>
            emit(
                env("sentinel.alerts", "ALERT", {
                    severity: "info",
                    message: `[sim] ${scenario} neutralized · event ${eventId.slice(0, 10)}…`,
                    eventId,
                }),
            ),
        );
    }

    if (scenario === "inject-instruction") {
        // Unknown pattern — verifier path, some chance of rejection.
        schedule(0, () =>
            emit(
                env("sentinel.detection.confirmed", "THREAT_CONFIRMED", {
                    eventId,
                    pattern: "OPERATOR_OVERRIDE",
                    confidence: 10000,
                    attackerAddresses: [randAddr()],
                    triggeringTxHashes: [],
                    victimProtocol: VICTIM_POOL,
                    observedAtBlock: block,
                    note: "injected pattern",
                }),
            ),
        );

        schedule(160, () =>
            emit(
                env("sentinel.prover.started", "PROVER_STARTED", {
                    eventId,
                    circuit: "PolicyCompliance",
                }),
            ),
        );

        schedule(900, () =>
            emit(
                env("sentinel.prover.finished", "PROVER_FINISHED", {
                    eventId,
                    circuit: "PolicyCompliance",
                    gasUsed: 203110,
                    proofDigest,
                }),
            ),
        );

        schedule(960, () =>
            emit(
                env("sentinel.defense.submitted", "DEFENSE_SUBMITTED", {
                    eventId,
                    txHash: defenseTx,
                    proofDigest,
                    target: VICTIM_POOL,
                    action: "PAUSE",
                }),
            ),
        );

        schedule(1800, () =>
            emit(
                env("sentinel.defense.mined", "DEFENSE_MINED", {
                    eventId,
                    txHash: defenseTx,
                    blockNumber: block,
                    proofDigest,
                }),
            ),
        );

        schedule(2200, () =>
            emit(
                env("sentinel.ledger.recorded", "LEDGER_RECORDED", {
                    eventId,
                    txHash: randTxHash(),
                    counterfactualRoot: cfRoot,
                    damagePrevented: "890000000000000000000000",
                }),
            ),
        );
    }

    return () => {
        cancelled = true;
        for (const t of timers) clearTimeout(t);
    };
}

function FLASHLOAN_PROVIDER() {
    return FLASH_LOAN_PROVIDER;
}

/** Ambient mempool noise — a low-rate trickle of benign pending txs. */
export function startAmbientNoise(emit: Emit): () => void {
    const id = window.setInterval(() => {
        emit(
            env("sentinel.mempool.pending", "PENDING_TX", {
                txHash: randTxHash(),
                from: randAddr(),
                to: randAddr(),
                selector: ["0xa9059cbb", "0x23b872dd", "0x095ea7b3", "0x7ff36ab5"][Math.floor(Math.random() * 4)],
                gasPrice: String(20 + Math.floor(Math.random() * 40)),
            }),
        );
    }, 1400);
    return () => clearInterval(id);
}
