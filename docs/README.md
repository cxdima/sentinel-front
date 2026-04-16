# SENTINEL v2 — Engineering Documentation

**Project:** Autonomous Threat Intelligence Protocol
**Status:** Pre-build — engineering kickoff
**Target:** 24-hour hackathon MVP + 7-day polish

---

## Purpose of This Repo

This folder contains all engineering documentation required to build SENTINEL v2. Every document assumes a knowledgeable blockchain engineering team (comfortable with Solidity, Foundry, ethers.js, ZK tooling, and L2 deployment). Documents are written to eliminate ambiguity — if something is unclear, that is a bug in the doc and should be raised immediately.

---

## Document Index

Read in this order:

| # | File | Purpose | Audience |
|---|------|---------|----------|
| 00 | [00_executive_overview.md](./00_executive_overview.md) | What we're building and why | Everyone |
| 01 | [01_system_architecture.md](./01_system_architecture.md) | Full system architecture across 6 layers | Everyone |
| 02 | [02_smart_contracts.md](./02_smart_contracts.md) | All Solidity contracts: interfaces, storage, events, invariants | Smart contract devs |
| 03 | [03_off_chain_services.md](./03_off_chain_services.md) | Detection, defense, simulation, prover services | Backend devs |
| 04 | [04_zk_proof_system.md](./04_zk_proof_system.md) | ZK circuits, RISC Zero integration, proof lifecycles | ZK / backend devs |
| 05 | [05_data_flow_and_sequences.md](./05_data_flow_and_sequences.md) | End-to-end sequence diagrams for every scenario | Everyone |
| 06 | [06_api_specifications.md](./06_api_specifications.md) | REST + WebSocket API contracts | Backend + frontend devs |
| 07 | [07_frontend_visualization.md](./07_frontend_visualization.md) | Frontend architecture, component tree, state model | Frontend devs |
| 08 | [08_infrastructure_and_deployment.md](./08_infrastructure_and_deployment.md) | Infra, Docker, CI/CD, RPC providers | DevOps / all |
| 09 | [09_hackathon_mvp_scope.md](./09_hackathon_mvp_scope.md) | **WHAT WE ACTUALLY BUILD IN 24 HOURS** | Everyone |
| 10 | [10_tech_stack.md](./10_tech_stack.md) | Exact library versions, pinned dependencies | Everyone |
| 11 | [11_testing_strategy.md](./11_testing_strategy.md) | Unit + integration + fork testing plan | Everyone |
| 12 | [12_demo_playbook.md](./12_demo_playbook.md) | The 90-second demo script, second by second | Everyone |

---

## Team Roles (Recommended Split)

**Engineer 1 — Smart Contracts & ZK**
Owns docs 02, 04. Writes Solidity, builds RISC Zero guest programs, wires ZK verifier on-chain.

**Engineer 2 — Off-Chain Backend**
Owns doc 03. Writes mempool monitor, detection engine, defense agent, Anvil fork driver for counterfactual simulation.

**Engineer 3 — Frontend**
Owns doc 07. Builds Trust Interface, Attack Intel Graph, Time-Scroll Audit, Evolution Battlefield.

**Engineer 4 — Integration & Demo**
Owns docs 09, 12. Builds the victim protocol, wires end-to-end flow, owns demo choreography.

---

## Build Rules

1. **Branch discipline:** `main` is always deployable. Feature branches named `feat/<engineer>-<component>`.
2. **No silent scope creep.** If you're deviating from the MVP scope in doc 09, flag it in standup.
3. **Commit to the demo, not the vision.** Everything that isn't in doc 12 is a stretch goal.
4. **All event logs, all ABI, all contract addresses live in `/config/` — single source of truth.**
5. **Mock before real.** If a service isn't ready, publish a mock conforming to the API contract in doc 06.

---

## Quick Start

```bash
git clone <repo>
cd sentinel-v2

# install root deps
pnpm install

# bring up local stack: Anvil + all services
docker compose up -d
pnpm dev

# open frontend
open http://localhost:3000
```

See [08_infrastructure_and_deployment.md](./08_infrastructure_and_deployment.md) for full setup.
