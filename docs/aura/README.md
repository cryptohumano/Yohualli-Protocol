# Aura (wallet) and Yohualli

*English and **Español (América Latina)**. Neutral Spanish, no voseo.*

---

## English

This repository (**Yohualli-Protocol**) is a **phase-0 monorepo** for **EIP-712 attestations**, **Noir (Honk) circuits**, **PVM/EVM**, **P2P**, and **digital personhood** proofs *off-chain* with **on-chain** settlement. The **wallet** foundation (Substrate, **sr25519** *keyring*, WebAuthn, *multi-chain*) comes from an evolutionary line of the **Aura Wallet** codebase.

### Upstream: Aura

- **Aura (Polkadot PWA)**: [cryptohumano/aura-pwa](https://github.com/cryptohumano/aura-pwa) — branches, history, and the original product surface.  
- *GitHub* description: client-side crypto, *dedot*, *Polkadot* API, identity, accounts.

### Why not a *branch* of the same repository?

Putting **Yohualli** and **Aura** on **two long-lived product branches in one repository** blurs *releases*, CI, docs, and *issues* for two different product stories. The usual model is: **one protocol repository** (this) + **one wallet repository** (Aura), cross-linked in docs; you can *cherry-pick* or sync, but a **single default branch** should not *alternate* between a generic *wallet* and a **ZK protocol** stack.

### “Institutional” (People / Substrate) *vs* *private* personhood

- **Substrate + People Chain (where relevant to Aura):** on-chain, curated or *registrar* identity; **sr25519** for native account signatures.  
- **Yohualli:** cryptographic *statement* on **secp256k1** (EIP-712, `HonkVerifier`, nullifiers / Merkle *per* docs) and **minimal disclosure** to participate without hanging the full graph *on-chain*.

That *complementarity* is in [Yohualli Protocol draft 1.1.md](../Yohualli%20Protocol%20draft%201.1.md) (intro, People *registrars*). If you need **Aura** for a specific feature and want to connect it to the protocol, clone [aura-pwa](https://github.com/cryptohumano/aura-pwa) and this repo **separately**.

Aura-specific docs that were **removed** from the default *tree* here: [ARCHIVE.md](./ARCHIVE.md).

---

## Español (América Latina)

Este repositorio (**Yohualli-Protocol**) es un **monorepo de fase 0** orientado a **atestaciones EIP-712**, **circuitos Noir (Honk)**, **PVM/EVM**, **P2P** y a **pruebas de personería** *off-chain* con *settlement* *on-chain*. La base de *wallet* (Substrate, *keyring* **sr25519**, WebAuthn, *multi-cadena*) proviene de una evolución del **Aura Wallet**.

### Repositorio *upstream*: Aura

- Código, ramas e historial del **Aura (PWA Polkadot)**: [cryptohumano/aura-pwa](https://github.com/cryptohumano/aura-pwa).  
- Descripción pública: cripto en *cliente*, *dedot*, *Polkadot* API, identidad y cuentas.

### Por qué no una *rama* del mismo repositorio

Mantener **Yohualli** y **Aura** en **ramas** del *mismo* *repo* mezcla *releases*, CI, documentación e *issues* de **dos** narrativas de producto. Lo habitual es un **repositorio de protocolo** (este) y **otro** de billetera (Aura), enlazados por *documentación*; podés *cherry-pick* o sincronizar, pero un **único** *default branch* no debería alternar entre billetera genérica y pila *ZK*.

### Capa “institucional” (People / Substrate) *frente* a *personalidad* *privada*

- **Substrate y People Chain (cuando encaja con Aura):** identidad pública, curación o *registrars*; **sr25519** para firmas.  
- **Yohualli:** *statement* cripto en **secp256k1** hacia *contratos* (EIP-712, `HonkVerifier`, *nullifiers* o Merkle según el *doc*), y **pruebas mínimas** de datos para actuar **sin** colgar todo el **grafo** *en cadena*.

Esa *complementariedad* se describe en [Yohualli Protocol draft 1.1.md](../Yohualli%20Protocol%20draft%201.1.md) (introducción y *People* / *Registrars*). Quien quiera *iterar* en **Aura** y luego *vincular* el *protocolo* puede clonar [aura-pwa](https://github.com/cryptohumano/aura-pwa) y **este** repositorio, por separado.

*Documentación* **Aura** **retirada** del árbol por *defecto* aquí: [ARCHIVE.md](./ARCHIVE.md).
