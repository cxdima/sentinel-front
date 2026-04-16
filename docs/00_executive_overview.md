# 00 — Executive Overview

## What SENTINEL v2 Is

SENTINEL v2 is an autonomous on-chain defense system for DeFi protocols. It watches the mempool, detects forming attacks, autonomously executes defenses within a single block, and **cryptographically proves what would have happened without the intervention** — writing that counterfactual to the chain as a permanent, verifiable record.

This is the core product: **a blockchain that records not just what happened, but what didn't happen.**

## Why It Wins (Technically)

Three capabilities no one else has combined:

1. **Dual-timeline execution.** When an attack is detected, we fork chain state at the pre-attack block and run both realities in parallel. The "real" timeline has our defense. The "shadow" timeline has the attack completing. We compute the financial delta and publish it on-chain with a ZK proof of simulation correctness.

2. **Policy-bounded AI agents.** The defense agent cannot execute any action that isn't provably compliant with the on-chain policy. We demonstrate this live by injecting a malicious instruction — the agent constructs the transaction, fails policy verification, and the transaction never reaches the chain. The math stops it.

3. **Adversarial co-evolution with ZK proofs.** A Red agent generates novel attack variants. A Blue agent must defeat them. Only when the Blue agent beats a statistically significant population of Red attacks does the policy update commit on-chain — and the whole loop runs privately, with a ZK proof attesting the update was earned, not injected.

## What "Jaw-Drop" Means Here

We're presenting to professional blockchain developers. They've seen smart contract AI agents, on-chain voting, DeFi bots. They have not seen:

- A system that shows two diverging financial timelines in real time on screen
- A cryptographic proof of alternate history written to a chain
- An AI that is mathematically incapable of acting outside its mandate, demonstrated by deliberately attempting to make it misbehave
- An arms race visualization where defense visibly gets harder to beat in real time

The demo script in doc 12 is choreographed specifically to produce these moments.

## What We're Not Building for the Hackathon

Read doc 09 carefully. The full vision is a multi-month build. The hackathon MVP is a deliberately narrowed slice with:

- One victim protocol (simple vulnerable lending pool)
- One attack pattern (flash loan oracle manipulation)
- One defense primitive (contract pause + fund quarantine)
- One ZK circuit (counterfactual proof — simulation correctness)
- Full Trust Collapse UI sequence
- Full Agent Constraint Failure demo

Everything else (pre-emptive strike, cross-protocol immunity, Red/Blue evolution) is **demonstrated via pre-rendered visualizations backed by real recorded runs**, not live during the pitch. That is not a cheat — it is the correct hackathon engineering decision. The underlying system really runs; we just don't run it live in the 90-second window.

## Primary Judge Target

1. **Blockchain & Decentralized AI track** — primary target, ~9 competing teams.
2. **Security in an AI-First World (IBM-sponsored)** — secondary target, ~20 competing teams.

Both tracks, one project. Effective competition pool: ~29 teams.

## Head-to-Head: SENTINEL v2 vs Current Solutions

Professional judges will compare this against tools they already know. Pre-empt the question.

| Capability | OpenZeppelin Defender | Forta Network | Manual Multisig | Generic ethers.js bot | **SENTINEL v2** |
|---|---|---|---|---|---|
| **Detection latency** | Event-driven (post-mine) | Post-mine (~seconds) | Human (~minutes) | Post-mine | **Mempool (pre-mine, <200ms)** |
| **Response latency** | ~10–30s (webhook + relay) | Alert only, no auto-response | 5–60 min | ~5–15s | **<3s in-block** |
| **Proof of what was prevented** | None | None | None | None | **ZK counterfactual proof on-chain** |
| **Operator override resistance** | None (operator IS the authority) | N/A | None | None | **Architecturally impossible — policy circuit is the authority** |
| **Quantified prevented loss** | None | None | None | None | **Dollar delta committed to chain with ZK proof** |
| **Network immunity propagation** | Protocol-scoped only | Alert sharing (manual opt-in) | None | None | **Automatic: threat signature → 12 protocols immune instantly** |
| **Adversarial hardening** | Static rules | Community-submitted bots | None | Static logic | **Red/Blue co-evolution; Blue policy hardens each generation** |
| **On-chain verifiability** | Off-chain logs | Off-chain alerts | Off-chain comms | Off-chain logs | **Every defense action, proof, and delta is on-chain** |

### The three capabilities no existing solution has

1. **Counterfactual proof.** Every other system tells you an attack was stopped. SENTINEL proves, cryptographically and on-chain, exactly how much was prevented and shows you the alternate timeline. This is not a log — it is an immutable ledger entry with a ZK proof of simulation correctness.

2. **Policy-bounded autonomy.** Defender and bots can be reprogrammed or overridden by whoever controls the key. SENTINEL's defense agent cannot execute an action that fails `PolicyVerifier.verify()`. The constraint is mathematical, not procedural.

3. **Sub-block response.** Every competitor detects post-mine. SENTINEL intercepts in the mempool and defends in the same block as the attack. By the time any other system fires an alert, the exploit either landed or SENTINEL already stopped it.

---

## What Technical Judges Will Ask

Prepare answers for:

- "Can you actually generate the ZK proof inside one block time?" (Answer in doc 04.)
- "How does the defense agent not become a kill switch for the operator?" (Answer: policy contract is the final authority; agent actions require verifier.verify() to return true.)
- "What stops the Red agent from just generating noise?" (Answer: win-rate threshold against a held-out Blue eval set.)
- "Why Anvil and not a real fork?" (Answer: deterministic replay + speed; covered in doc 03.)
- "What's the gas cost of writing a counterfactual proof?" (Answer in doc 02.)

All these are addressed in the relevant doc. Every engineer should be able to answer any of them without looking.
