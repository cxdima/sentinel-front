/**
 * WebSocket event source for the SENTINEL api-gateway firehose.
 *
 * Wraps /ws with auto-reconnect, hello handshake, and multi-channel subscription.
 * Emits typed envelopes to registered listeners.
 */
import { wsUrl } from "./api";

export interface EventEnvelope {
    channel: string;
    messageId: string;
    emittedAt: string;
    kind: string;
    data: Record<string, unknown>;
}

export type SentinelEvent =
    | { op: "event"; channel: string; data: EventEnvelope }
    | { op: "welcome"; serverTime: string; version?: string; subscriptionsAvailable?: string[] }
    | { op: "subscribed"; channel: string }
    | { op: "unsubscribed"; channel: string }
    | { op: "pong"; ts: number }
    | { op: "error"; code: string; message: string };

export type EventListener = (envelope: EventEnvelope) => void;
export type StatusListener = (status: WsStatus) => void;

export type WsStatus = "connecting" | "open" | "closed" | "error";

export class SentinelSocket {
    private socket: WebSocket | null = null;
    private readonly channels: Set<string>;
    private readonly listeners = new Set<EventListener>();
    private readonly statusListeners = new Set<StatusListener>();
    private reconnectTimer = 0;
    private backoff = 500;
    private shouldReconnect = true;
    private _status: WsStatus = "closed";

    constructor(channels: string[] = ["events.all"]) {
        this.channels = new Set(channels);
    }

    get status(): WsStatus {
        return this._status;
    }

    connect(): void {
        if (
            this.socket &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
        )
            return;
        this.shouldReconnect = true;
        this.setStatus("connecting");

        try {
            this.socket = new WebSocket(wsUrl());
        } catch {
            this.setStatus("error");
            this.scheduleReconnect();
            return;
        }

        this.socket.addEventListener("open", () => {
            this.backoff = 500;
            this.setStatus("open");
            this.send({ op: "hello", version: "1.0" });
            for (const ch of this.channels) this.send({ op: "subscribe", channel: ch });
        });

        this.socket.addEventListener("message", (ev) => {
            let msg: SentinelEvent;
            try {
                msg = JSON.parse(String(ev.data)) as SentinelEvent;
            } catch {
                return;
            }
            if (msg.op === "event") {
                for (const l of this.listeners) l(msg.data);
            }
        });

        this.socket.addEventListener("close", () => {
            this.setStatus("closed");
            if (this.shouldReconnect) this.scheduleReconnect();
        });

        this.socket.addEventListener("error", () => {
            this.setStatus("error");
        });
    }

    close(): void {
        this.shouldReconnect = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = 0;
        }
        this.socket?.close();
        this.socket = null;
    }

    onEvent(l: EventListener): () => void {
        this.listeners.add(l);
        return () => this.listeners.delete(l);
    }

    onStatus(l: StatusListener): () => void {
        this.statusListeners.add(l);
        l(this._status);
        return () => this.statusListeners.delete(l);
    }

    private setStatus(s: WsStatus): void {
        if (s === this._status) return;
        this._status = s;
        for (const l of this.statusListeners) l(s);
    }

    private send(obj: unknown): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify(obj));
    }

    private scheduleReconnect(): void {
        if (!this.shouldReconnect) return;
        if (this.reconnectTimer) return;
        const delay = Math.min(this.backoff, 8000);
        this.backoff = Math.min(this.backoff * 2, 8000);
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = 0;
            this.connect();
        }, delay);
    }
}
