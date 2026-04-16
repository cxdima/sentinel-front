# 08 — Infrastructure & Deployment

## Repo Layout

Monorepo, managed with `pnpm` workspaces.

```
sentinel-v2/
├── contracts/                # Foundry project
│   ├── src/
│   ├── test/
│   ├── script/
│   ├── lib/
│   └── foundry.toml
├── services/
│   ├── mempool-monitor/      # TypeScript
│   ├── counterfactual-sim/   # TypeScript
│   ├── api-gateway/          # TypeScript
│   ├── detection-engine/     # Python
│   ├── defense-agent/        # Python
│   └── zk-prover/            # Rust (guest) + TS (wrapper)
├── frontend/                 # React + Vite
├── zk/                       # Shared ZK crates
│   ├── guest/
│   │   ├── policy-compliance/
│   │   ├── counterfactual-correctness/
│   │   └── learning-correctness/
│   ├── host/                 # Host wrappers
│   └── shared/               # Types shared across circuits
├── schemas/                  # JSON Schema for events
├── config/                   # Shared config (addresses, policy, timings)
│   ├── addresses.local.json
│   ├── policy.json
│   ├── timings.json
│   ├── selectors.json
│   └── abis/
├── infra/
│   ├── docker/
│   ├── grafana/
│   └── prometheus/
├── scripts/
│   ├── bootstrap.sh
│   ├── seed-demo-state.sh
│   └── replay-scenario.sh
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

## Local Dev Environment

### Prerequisites

- Node.js 20.x (via `nvm`)
- pnpm 8.x
- Python 3.11+ with `poetry`
- Rust 1.74+ (via `rustup`)
- Docker + Docker Compose
- Foundry (`foundryup`)
- RISC Zero: `cargo install cargo-risczero`

### Bootstrap

```bash
./scripts/bootstrap.sh
```

This script:
1. Installs Foundry deps (`forge install`)
2. Installs pnpm workspace deps
3. Installs Python virtualenvs via poetry
4. Builds RISC Zero guest programs (cached after first run)
5. Compiles verifier contracts
6. Boots local Anvil
7. Deploys contracts, seeds demo state
8. Writes `/config/addresses.local.json`

Expect first run to take 10–15 minutes (mostly RISC Zero build). Subsequent runs: ~30s.

### Run Everything

```bash
docker compose up
```

Brings up:
- `anvil` (Foundry's EVM node) on :8545
- `anvil-fork-pool` (a warm pool of pre-spawned Anvil forks for counterfactual sim)
- `postgres` on :5432 (event store)
- `redis` on :6379 (event bus)
- `api-gateway` on :8080 / :8081
- `mempool-monitor`
- `detection-engine`
- `defense-agent`
- `counterfactual-sim`
- `zk-prover`
- `frontend` on :3000

### Useful Commands

```bash
# reset local chain + redeploy everything
./scripts/reset.sh

# replay the demo scenario end to end
./scripts/replay-scenario.sh flash-loan-oracle

# tail all service logs
docker compose logs -f

# tail a specific service
docker compose logs -f defense-agent

# shell into a service
docker compose exec defense-agent /bin/bash
```

## docker-compose.yml (abridged)

```yaml
version: "3.9"

services:
  anvil:
    image: ghcr.io/foundry-rs/foundry:latest
    command: >
      anvil
      --host 0.0.0.0
      --block-time 2
      --chain-id 31337
      --gas-limit 30000000
      --accounts 10
      --mnemonic "test test test test test test test test test test test junk"
    ports: ["8545:8545"]

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: sentinel
      POSTGRES_PASSWORD: sentinel
      POSTGRES_DB: sentinel
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api-gateway:
    build: ./services/api-gateway
    environment:
      RPC_URL: http://anvil:8545
      REDIS_URL: redis://redis:6379
      POSTGRES_URL: postgresql://sentinel:sentinel@postgres:5432/sentinel
      ADDRESSES_FILE: /config/addresses.local.json
    volumes:
      - ./config:/config:ro
    ports: ["8080:8080", "8081:8081"]
    depends_on: [anvil, redis, postgres]

  # ... other services similarly

  frontend:
    build: ./frontend
    environment:
      VITE_API_URL: http://localhost:8080
      VITE_WS_URL: ws://localhost:8081/ws
    ports: ["3000:3000"]

volumes:
  pgdata:
```

Full file at `/docker-compose.yml`.

## Environment Variables

All services read config from environment. `.env.example` in repo root lists every variable. Never commit real `.env`.

Key variables:

| Variable | Purpose |
|----------|---------|
| `RPC_URL` | Primary Anvil URL |
| `REDIS_URL` | Redis pub/sub |
| `POSTGRES_URL` | Event store |
| `DEFENSE_AGENT_KEY` | Private key of defense agent (dev only; burn address) |
| `PROVE_BACKEND` | `bonsai` \| `local` |
| `BONSAI_API_URL`, `BONSAI_API_KEY` | RISC Zero Bonsai credentials |
| `ADDRESSES_FILE` | Path to deployed addresses JSON |

## Networking

All services communicate over the Docker bridge network `sentinel-net`. Frontend (on host) talks to api-gateway via published ports. Services do not expose ports externally except api-gateway + frontend.

## Persistence

- Contract deployments: ephemeral (redeploy on every Anvil restart)
- Event records: Postgres (persist across restarts; use `docker compose down -v` to wipe)
- Proof cache: Postgres + filesystem volume `/zk-cache`

For demo, start fresh every time: `./scripts/reset.sh`.

## Observability

- Logs: pino JSON to stdout; `docker compose logs -f` aggregates.
- Metrics: every service exports Prometheus on port 9090 internally; Grafana at :3001 (optional for demo).
- Traces: OpenTelemetry hooks present but OTLP endpoint unset by default. Enable with `OTEL_EXPORTER_OTLP_ENDPOINT`.

## CI/CD

### CI (GitHub Actions)

`.github/workflows/ci.yml`:

1. Install Foundry, pnpm, poetry, cargo.
2. `forge build` + `forge test` for contracts.
3. `pnpm lint` + `pnpm typecheck` for TS services.
4. `pnpm test` for TS unit tests.
5. `poetry run pytest` for Python services.
6. `cargo build --release` for Rust guests (cached).
7. Lightweight integration: boot Anvil, deploy, run one scripted scenario end-to-end.

Goal: green CI in < 10 minutes.

### CD

MVP: none. We ship the demo live from a laptop. Address caching ensures reproducibility.

Post-hackathon: deploy to Base Sepolia via `forge script` with a dedicated deployer key. Frontend deploys to Vercel.

## Demo Environment Hardening

Before the pitch:

1. Run `./scripts/reset.sh` — clean state.
2. Run `./scripts/seed-demo-state.sh` — fund the attacker, warm the victim pool, populate the threat registry with 5 pre-generated signatures.
3. Run `./scripts/pre-warm-proofs.sh` — generate and cache the proofs we'll need during demo.
4. Open frontend at `http://localhost:3000/demo`.
5. Keep a terminal open tailing `defense-agent` logs as a backup if the visual side of something goes wrong.

If anything goes south, `./scripts/reset.sh && ./scripts/seed-demo-state.sh && ./scripts/pre-warm-proofs.sh` resets the full demo state in < 60s.

## Failure Recovery During Demo

- **Anvil dies:** container auto-restarts via `restart: unless-stopped`.
- **WebSocket disconnect:** frontend auto-reconnects with backoff, replays from last `messageId`.
- **Proof gen timeout:** cache fallback takes over transparently.
- **Detection misses the attack:** the demo scenario endpoint (`POST /demo/replay-scenario`) can re-trigger. Keep this in a stashed tab.

## Security Notes (because judges might ask)

- Defense agent key is a dev-only burner. Do not reuse.
- On production, policy governance would be multisig-controlled; agent would be a keyless submitter (using account abstraction / ERC-4337 with strict entry point validation).
- ZK proofs are the primary trust anchor; signing keys are revocable.
