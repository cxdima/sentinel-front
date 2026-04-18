/**
 * DefiLlama TVL fetcher.
 *
 * Feature-flagged via VITE_USE_LIVE_TVL=1 — off by default so air-gapped
 * demo rehearsals don't hit the network. When on, pulls once on boot and
 * caches for an hour in sessionStorage.
 */

interface LlamaProtocol {
    slug: string;
    name: string;
    tvl: number;
}

/** slug (DefiLlama canonical) → short code used in the mesh */
const SLUG_TO_SHORT: Record<string, string> = {
    aave: "AAVE",
    uniswap: "UNI",
    makerdao: "MKR",
    lido: "LIDO",
    "curve-dex": "CRV",
    "compound-finance": "COMP",
    balancer: "BAL",
    synthetix: "SNX",
    dydx: "DYDX",
    "yearn-finance": "YFI",
    sushi: "SUSHI",
    "1inch-network": "1INCH",
};

const CACHE_KEY = "sentinel:tvl:v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface TvlMap {
    [short: string]: string; // formatted, e.g. "$8.2B"
}

function fmt(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
}

function readCache(): TvlMap | null {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { at, map } = JSON.parse(raw) as { at: number; map: TvlMap };
        if (Date.now() - at > CACHE_TTL_MS) return null;
        return map;
    } catch {
        return null;
    }
}

function writeCache(map: TvlMap): void {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), map }));
    } catch {}
}

function enabled(): boolean {
    return (import.meta.env.VITE_USE_LIVE_TVL as string | undefined) === "1";
}

/**
 * Fetch live TVLs for the 12 tracked protocols. Returns a map keyed by
 * SHORT code (AAVE / UNI / etc.). Empty object if disabled or on failure —
 * callers should fall back to their compiled-in labels.
 */
export async function fetchLiveTvls(): Promise<TvlMap> {
    if (!enabled()) return {};
    const cached = readCache();
    if (cached) return cached;

    try {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch("https://api.llama.fi/protocols", { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) return {};
        const body = (await res.json()) as LlamaProtocol[];
        const map: TvlMap = {};
        for (const p of body) {
            const short = SLUG_TO_SHORT[p.slug];
            if (!short) continue;
            if (!Number.isFinite(p.tvl)) continue;
            map[short] = fmt(p.tvl);
        }
        if (Object.keys(map).length > 0) writeCache(map);
        return map;
    } catch {
        return {};
    }
}
