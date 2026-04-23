# PoC dilemma: Honk (ECDSA) in the PWA and “bring your own infrastructure” (BYOI) — English

**Español (full text, body normativo):** [YOHUALLI_POC_PWA_PROVER_DILEMMA.md](YOHUALLI_POC_PWA_PROVER_DILEMMA.md)  
**Policy:** [protocol-docs-languages.md](protocol-docs-languages.md)

## Summary

This document records a **decision** about lab work with Noir, **Barretenberg** `bb.js` (WASM), and the [`yohualli_merkle_attest_v1`](../circuits/yohualli_merkle_attest_v1/src/main.nr) circuit (ECDSA `secp256k1` in-circuit plus a public `merkle_root` output). It does **not** replace the long [Yohualli Protocol draft 1.1](Yohualli%20Protocol%20draft%201.1.md) — it only **grounds** where a proof is generated in a realistic deployment.

- **Phase 0** showed proof generation inside the PWA (iOS and Android) for a lab build. That does **not** imply that “everyone must use BYOI to ever prove” is a logical truth: on capable devices, on-device proof remains an option.  
- What is **not** sound for a product line, yet, is to **rely only** on in-browser proof for a heavy Honk/ECDSA statement on **every** device, without a documented fallback (CI, nargo+bb, relayer, or helper).  
- **BYOI** means: (1) reproducible nargo/bb in dev and CI, (2) optional paths for low memory or batch jobs, (3) it is not a claim that PWA proof never works on-device.

Sections 1 through 5 and the subsection *Aclaración: BYOI no reemplaza* are **Spanish-only**; read the linked file for the full text.
