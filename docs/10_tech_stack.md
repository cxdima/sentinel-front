# 10 — Tech Stack & Pinned Dependencies

Every major dependency is pinned to a specific version. Do not upgrade during the hackathon.

## Runtime Versions

- **Node.js:** 20.11.1 (LTS)
- **pnpm:** 8.15.4
- **Python:** 3.11.8
- **poetry:** 1.7.1
- **Rust:** 1.74.1
- **Foundry:** stable as of 2026-04-01 (`foundryup` at kickoff, then pin commit)
- **RISC Zero:** v1.0.x (latest stable at kickoff)

## Smart Contracts (Foundry)

`contracts/foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = true
fs_permissions = [{ access = "read-write", path = "./" }]

[fuzz]
runs = 256

[invariant]
runs = 64
depth = 128
```

Libraries (via `forge install`):

- `OpenZeppelin/openzeppelin-contracts@v5.0.2`
- `foundry-rs/forge-std@v1.7.6`
- `risc0/risc0-ethereum@v1.0.0`

## TypeScript Services (pnpm)

Shared `package.json` manifests pin exact versions:

### mempool-monitor / counterfactual-sim

```json
{
    "dependencies": {
        "ethers": "6.11.1",
        "viem": "2.8.13",
        "ioredis": "5.3.2",
        "pino": "8.19.0",
        "pino-pretty": "10.3.1",
        "zod": "3.22.4",
        "fastify": "4.26.2",
        "ws": "8.16.0"
    },
    "devDependencies": {
        "typescript": "5.3.3",
        "tsx": "4.7.1",
        "vitest": "1.4.0",
        "@types/node": "20.11.24",
        "@types/ws": "8.5.10"
    }
}
```

### api-gateway

```json
{
    "dependencies": {
        "fastify": "4.26.2",
        "@fastify/websocket": "10.0.1",
        "@fastify/cors": "9.0.1",
        "ioredis": "5.3.2",
        "viem": "2.8.13",
        "pg": "8.11.3",
        "pino": "8.19.0",
        "zod": "3.22.4"
    }
}
```

## Python Services (poetry)

### detection-engine

`pyproject.toml`:

```toml
[tool.poetry.dependencies]
python = "^3.11"
web3 = "6.15.1"
redis = { extras = ["hiredis"], version = "5.0.2" }
numpy = "1.26.4"
scikit-learn = "1.4.1.post1"
onnxruntime = "1.17.1"
pydantic = "2.6.3"
uvloop = "0.19.0"
orjson = "3.9.15"
structlog = "24.1.0"

[tool.poetry.group.dev.dependencies]
pytest = "8.0.2"
pytest-asyncio = "0.23.5"
ruff = "0.3.0"
mypy = "1.8.0"
```

### defense-agent

Same base + `eth-account==0.11.0`, `eth-abi==5.0.1`.

## Rust (zk-prover guest programs)

`Cargo.toml` workspace:

```toml
[workspace]
members = ["guest/*", "host"]
resolver = "2"

[workspace.dependencies]
risc0-zkvm = { version = "=1.0.1", default-features = false }
risc0-zkvm-platform = "=1.0.1"
serde = { version = "1.0.197", features = ["derive"] }
serde_json = "1.0.114"
sha2 = "0.10.8"
bls-signatures = "0.15"
hex = "0.4.3"
```

## Frontend

`frontend/package.json`:

```json
{
    "dependencies": {
        "react": "18.2.0",
        "react-dom": "18.2.0",
        "react-router-dom": "6.22.1",
        "zustand": "4.5.1",
        "viem": "2.8.13",
        "d3": "7.8.5",
        "framer-motion": "11.0.8",
        "@tanstack/react-query": "5.24.1"
    },
    "devDependencies": {
        "vite": "5.1.5",
        "@vitejs/plugin-react": "4.2.1",
        "typescript": "5.3.3",
        "tailwindcss": "3.4.1",
        "autoprefixer": "10.4.17",
        "postcss": "8.4.35",
        "@types/d3": "7.4.3",
        "@types/react": "18.2.61"
    }
}
```

## Docker Base Images

| Service | Image |
|---------|-------|
| anvil | `ghcr.io/foundry-rs/foundry:latest` |
| postgres | `postgres:16-alpine` |
| redis | `redis:7-alpine` |
| node services | `node:20.11.1-bookworm-slim` |
| python services | `python:3.11.8-slim-bookworm` |
| rust guests | `rust:1.74.1-bookworm` |
| frontend | `node:20.11.1-bookworm-slim` |

## Infrastructure

- **Anvil:** local Foundry EVM, block time 2s.
- **Postgres:** 16.x for event store.
- **Redis:** 7.x for pub/sub.
- **Prometheus / Grafana:** optional for demo; set up at leisure.

## External Services

- **Bonsai:** RISC Zero remote proving. API key in `.env`. Rate limits: monitor via dashboard.
- **No mainnet fork RPC required for MVP.** We fork from our own Anvil.

## License Notes

- OpenZeppelin: MIT
- ethers / viem: MIT
- RISC Zero: Apache-2.0
- Foundry: Apache-2.0/MIT

No copyleft dependencies. MVP repo is OK to ship under MIT or Apache-2.0.

## Build Tooling

- **turbo** for workspace orchestration: `turbo run build`, `turbo run dev`.
- **biome** for TS linting + formatting (single tool, fast).
- **ruff** + **mypy** for Python.
- **cargo fmt** + **clippy** for Rust.
- **forge fmt** for Solidity.

Pre-commit hook runs all formatters + linters. Set up via `lefthook` or husky; config at `.lefthook.yml`.

## Versions Locked By

```
# root
pnpm-lock.yaml
poetry.lock (per service)
Cargo.lock
foundry.lock  (commit hash of foundryup toolchain)
```

All locks committed. Do not regenerate during the hackathon.
