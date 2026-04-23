# ZK Circuits in this repository (lab) — English

- **Full Spanish (authoritative, detailed):** [CIRCUITS_LAB.md](CIRCUITS_LAB.md)  
- **Bilingual index:** [protocol-docs-languages.md](protocol-docs-languages.md)  
- **PoC prover placement (PWA vs BYOI):** [YOHUALLI_POC_PWA_PROVER_DILEMMA.md](YOHUALLI_POC_PWA_PROVER_DILEMMA.md)

## What this lab covers (short)

- **Noir** packages under `circuits/`: `square` (tutorial), `yohualli_subject_commitment_v0` (keccak, 32 publics, lighter prover), `yohualli_one_attest_sig` (v0, ECDSA on 32B digest, ~4.3e4 gates), `yohualli_merkle_attest_v1` (v1, ECDSA and `merkle_root`, 128 public rows for the UI).
- **Foundry** package `evm/yohualli_honk_verifier/`: `HonkVerifier` from `bb write_solidity_verifier`, deploy scripts, Polkadot Hub testnet by default, `VITE_PASEO_VERIFIER_ADDRESS` in the PWA.
- **`src/circuits/`** holds ABI, proof encoding, embedded samples for v0/v1, workers for `bb` and the Noir prover, and `artifacts` copies after `nargo compile`.
- **Barretenberg in browser** — msgpack scratch limits and the `Length is too large` class of errors: see the postinstall script and the Vite plugin; full runbook in the **Spanish** [CIRCUITS_LAB.md](CIRCUITS_LAB.md) and in `scripts/patch-aztec-bb-msgpack-scratch.mjs` and `vite.config.ts`.

**UI:** [ZkLab.tsx](../src/pages/ZkLab.tsx) on route `/zk-lab`. **Removed** from the project: in-browser solc-js compile (use Foundry locally for deploy).

For full tables, deep Barretenberg notes, and the protocol document index, read the **Spanish** [CIRCUITS_LAB.md](CIRCUITS_LAB.md).
