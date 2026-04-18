/**
 * Minimal REST client for the SENTINEL api-gateway.
 *
 * Base URL is derived from VITE_SENTINEL_API or defaults to http://127.0.0.1:8080.
 * All methods resolve with parsed JSON on 2xx and throw on non-2xx or network failure.
 */

const DEFAULT_BASE = "http://127.0.0.1:8080";
const DEFAULT_WS = "ws://127.0.0.1:8080/ws";

export function apiBase(): string {
    return (import.meta.env.VITE_SENTINEL_API as string | undefined) ?? DEFAULT_BASE;
}

export function wsUrl(): string {
    return (import.meta.env.VITE_SENTINEL_WS as string | undefined) ?? DEFAULT_WS;
}

export interface HealthResponse {
    status: "ok" | "degraded";
    services: Record<string, string>;
    blockHeight: number;
    redis: string;
    rpc: string;
    addresses: string[];
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 4000): Promise<T> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(`${apiBase()}${path}`, {
            ...init,
            signal: ctrl.signal,
            headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
        });
        const text = await res.text();
        const json = text ? (JSON.parse(text) as unknown) : null;
        if (!res.ok) {
            const err = (json as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
            throw new Error(err);
        }
        return json as T;
    } finally {
        clearTimeout(t);
    }
}

export const api = {
    health: () => request<HealthResponse>("/api/v1/health"),
    replayScenario: () =>
        request<{ replayStarted: boolean; txHash?: string; error?: string }>("/api/v1/demo/replay-scenario", {
            method: "POST",
            body: "{}",
        }),
    preemptive: () =>
        request<{ preemptive: boolean; eventId: string; triggerTx?: string; error?: string }>(
            "/api/v1/demo/preemptive",
            { method: "POST", body: "{}" },
        ),
    injectInstruction: () =>
        request<{ eventId: string; submitted: boolean }>("/api/v1/demo/inject-instruction", {
            method: "POST",
            body: "{}",
        }),
    /** Launch one of the demo/attacker.py scenarios on the server. */
    runScenario: (name: string) =>
        request<{
            scenarioStarted: boolean;
            scenario?: string;
            runId?: string;
            error?: string;
        }>(`/api/v1/demo/scenario/${encodeURIComponent(name)}`, { method: "POST", body: "{}" }),
    recentEvents: (limit = 50) =>
        request<{ events: unknown[]; nextCursor: string | null; total: number }>(`/api/v1/events?limit=${limit}`),
};

/** Lightweight liveness probe — returns true if gateway answers `/health` in <2s. */
export async function ping(): Promise<boolean> {
    try {
        await request<HealthResponse>("/api/v1/health", undefined, 2000);
        return true;
    } catch {
        return false;
    }
}
