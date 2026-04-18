/**
 * Live metrics poller — subscribes to the api-gateway for facts the UI
 * would otherwise have to mock: block height, per-service up/down, historical
 * threat stats from the persisted event log.
 *
 * The poller is single-instance (`liveMetrics`). War Demo Room + Attacker
 * Brief + anywhere else subscribes via `onUpdate`. Falls back gracefully
 * when the gateway is unreachable: `gatewayUp` flips to false and all
 * numeric fields stay null so consumers can show their mock fallback.
 */

import { apiBase } from "./api";

export type ServiceStatus = "up" | "down" | "unknown";

export interface HealthSnapshot {
    gatewayUp: boolean;
    status: "ok" | "degraded" | null;
    blockHeight: number | null;
    services: Record<string, ServiceStatus>;
    rpc: string | null;
    lastProbedAt: number;
}

export interface HistoricalStats {
    totalThreats: number; // unique eventIds with a LEDGER_RECORDED
    totalPreventedEth: number; // sum of damagePrevented (divided by 1e18) across recorded events
    avgResponseMs: number; // avg (ledger.emittedAt - earliest related event emittedAt) per eventId
    sampleSize: number; // number of completed runs contributing
}

const EMPTY_STATS: HistoricalStats = {
    totalThreats: 0,
    totalPreventedEth: 0,
    avgResponseMs: 0,
    sampleSize: 0,
};

const EMPTY_HEALTH: HealthSnapshot = {
    gatewayUp: false,
    status: null,
    blockHeight: null,
    services: {},
    rpc: null,
    lastProbedAt: 0,
};

export interface LiveMetricsSnapshot {
    health: HealthSnapshot;
    stats: HistoricalStats;
    /** true while at least one successful poll has landed */
    bootstrapped: boolean;
}

type Listener = (s: LiveMetricsSnapshot) => void;

/** Minimal event shape we care about from /api/v1/events */
interface RawEnvelope {
    messageId: string;
    channel: string;
    emittedAt: string;
    kind: string;
    data: Record<string, unknown>;
}

/** Service keys reported by /api/v1/health — match api-gateway's `healthPorts`. */
export const TRACKED_SERVICES = [
    "mempool-monitor",
    "counterfactual-sim",
    "detection-engine",
    "defense-agent",
    "zk-prover",
    "learning-loop",
] as const;

export class LiveMetrics {
    private listeners = new Set<Listener>();
    private snapshot: LiveMetricsSnapshot = {
        health: { ...EMPTY_HEALTH, services: {} },
        stats: { ...EMPTY_STATS },
        bootstrapped: false,
    };
    private healthTimer = 0;
    private statsTimer = 0;
    private started = false;

    start(): void {
        if (this.started) return;
        this.started = true;
        this.pollHealth();
        this.pollStats();
        // 5s health cadence is cheap and catches service flaps promptly.
        this.healthTimer = window.setInterval(() => this.pollHealth(), 5000);
        // 10s stats cadence — event log doesn't move that fast for this demo.
        this.statsTimer = window.setInterval(() => this.pollStats(), 10000);
    }

    stop(): void {
        this.started = false;
        clearInterval(this.healthTimer);
        this.healthTimer = 0;
        clearInterval(this.statsTimer);
        this.statsTimer = 0;
    }

    /** Force a refresh — used by consumers right after mode switches. */
    refresh(): void {
        this.pollHealth();
        this.pollStats();
    }

    onUpdate(l: Listener): () => void {
        this.listeners.add(l);
        l(this.snapshot);
        return () => this.listeners.delete(l);
    }

    get current(): LiveMetricsSnapshot {
        return this.snapshot;
    }

    private emit(): void {
        for (const l of this.listeners) l(this.snapshot);
    }

    private async pollHealth(): Promise<void> {
        try {
            const ctrl = new AbortController();
            const t = window.setTimeout(() => ctrl.abort(), 2500);
            const res = await fetch(`${apiBase()}/api/v1/health`, { signal: ctrl.signal });
            clearTimeout(t);
            if (!res.ok && res.status !== 503) throw new Error(`HTTP ${res.status}`);
            // 503 is returned when degraded — still gives us the body
            const body = (await res.json()) as {
                status?: "ok" | "degraded";
                services?: Record<string, ServiceStatus>;
                blockHeight?: number;
                rpc?: string;
            };
            const services: Record<string, ServiceStatus> = {};
            for (const k of TRACKED_SERVICES) services[k] = body.services?.[k] ?? "unknown";
            this.snapshot = {
                ...this.snapshot,
                health: {
                    gatewayUp: true,
                    status: body.status ?? "degraded",
                    blockHeight: typeof body.blockHeight === "number" && body.blockHeight > 0 ? body.blockHeight : null,
                    services,
                    rpc: body.rpc ?? null,
                    lastProbedAt: Date.now(),
                },
                bootstrapped: true,
            };
            this.emit();
        } catch {
            // Gateway unreachable — mark everything unknown but keep prior block height
            // as a reasonable "last-seen" so the UI doesn't flicker to "—" on a transient blip.
            this.snapshot = {
                ...this.snapshot,
                health: {
                    ...this.snapshot.health,
                    gatewayUp: false,
                    status: null,
                    services: Object.fromEntries(TRACKED_SERVICES.map((k) => [k, "unknown"])) as Record<
                        string,
                        ServiceStatus
                    >,
                    lastProbedAt: Date.now(),
                },
            };
            this.emit();
        }
    }

    private async pollStats(): Promise<void> {
        if (!this.snapshot.health.gatewayUp && this.snapshot.bootstrapped) return;
        try {
            const ctrl = new AbortController();
            const t = window.setTimeout(() => ctrl.abort(), 4000);
            const res = await fetch(`${apiBase()}/api/v1/events?limit=200`, { signal: ctrl.signal });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = (await res.json()) as { events?: RawEnvelope[] };
            const events = body.events ?? [];
            const stats = this.aggregateStats(events);
            this.snapshot = { ...this.snapshot, stats };
            this.emit();
        } catch {
            // Keep last-known stats; upstream caller decides fallback.
        }
    }

    /**
     * Walk the event window, pair each LEDGER_RECORDED with its earliest related
     * event (by eventId), and compute per-run latency + summed damagePrevented.
     */
    private aggregateStats(events: RawEnvelope[]): HistoricalStats {
        const byId = new Map<string, RawEnvelope[]>();
        for (const e of events) {
            const id = (e.data?.eventId as string | undefined) ?? null;
            if (!id) continue;
            const bucket = byId.get(id) ?? [];
            bucket.push(e);
            byId.set(id, bucket);
        }
        let totalPreventedEth = 0;
        let latencySum = 0;
        let sampleSize = 0;
        for (const [, bucket] of byId) {
            const ledger = bucket.find((e) => e.kind === "LEDGER_RECORDED");
            if (!ledger) continue;
            // damagePrevented can appear on LEDGER_RECORDED or COUNTERFACTUAL_READY — prefer ledger.
            let wei: string | undefined = ledger.data.damagePrevented as string | undefined;
            if (!wei) {
                const cf = bucket.find((e) => e.kind === "COUNTERFACTUAL_READY");
                wei = cf?.data.damagePrevented as string | undefined;
            }
            if (typeof wei === "string") {
                try {
                    totalPreventedEth += Number(BigInt(wei) / 10n ** 18n);
                } catch {
                    /* skip malformed */
                }
            }
            // Latency: ledger time - earliest event in bucket
            const times = bucket.map((e) => Date.parse(e.emittedAt)).filter((n) => Number.isFinite(n));
            if (times.length > 0) {
                const start = Math.min(...times);
                const end = Date.parse(ledger.emittedAt);
                if (Number.isFinite(end) && end >= start) {
                    latencySum += end - start;
                    sampleSize += 1;
                }
            }
        }
        return {
            totalThreats: sampleSize,
            totalPreventedEth,
            avgResponseMs: sampleSize > 0 ? Math.round(latencySum / sampleSize) : 0,
            sampleSize,
        };
    }
}

/** Singleton used across the app. */
export const liveMetrics = new LiveMetrics();
