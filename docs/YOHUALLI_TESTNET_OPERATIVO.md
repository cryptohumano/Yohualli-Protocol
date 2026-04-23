# Testnet: operational checklist (Polkadot Hub EVM + Yohualli)

*This document is in **English** and **Español (América Latina, neutral)**. Language policy: [protocol-docs-languages.md](./protocol-docs-languages.md).*

---

## English

**Goal:** a fixed **registry** with `HonkVerifier` v1 (Merkle attest), a per-epoch **Merkle root** aligned with proofs, and the PWA (ZK Lab) configured with environment variables. **Never** place deploy secrets in `VITE_` (see [ENV_SAFETY.md](ENV_SAFETY.md) and the toolbox).

### Prerequisites

- Test PAS (or gas) on the same key that is **owner** of `YohualliMerkleHonkRegistry` (e.g. EOA on `m/44'/60'/0'/0/0` for funding).
- **EVM RPC** — in the PWA, default is `https://eth-rpc-testnet.polkadot.io` (or yours). **cast** and **forge** must use the **same** URL.
- **VK** and `HonkVerifier.sol` in the repo must match the **deployed** circuit (`yohualli_merkle_attest_v1` and `verifier:sync:honk:merkle-v1`).

### 1. Shell variables (Foundry)

| Variable | Role |
|----------|------|
| `RPC_URL` | Node URL; required in `evm:forge:*` in the root `package.json` |
| `PRIVATE_KEY` | Deployer `0x…`, or |
| `MNEMONIC` + `ACCOUNT_INDEX` | Same as `DeployHonkVerifier` (0 = first MetaMask-style account) |
| `HONK_VERIFIER_ADDRESS` | Example v1 Merkle: `0x9D098225B1C375F95576047C6D6F0252126CaFE6` — **do not** use v0 (e.g. `0xcc6d…`) with v1 proofs of 128 publics |
| `YOHUALLI_MERKLE_REGISTRY` | After step 2 |

### 2. Deploy or reuse contracts

**A) HonkVerifier** (if it is not on testnet)

```bash
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
# export PRIVATE_KEY=0x…   or   export MNEMONIC="…" && export ACCOUNT_INDEX=0
npm run evm:forge:honk
```

Save the printed address as `HONK_VERIFIER_ADDRESS`.

**B) YohualliMerkleHonkRegistry (CREATE only)**

```bash
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
# same key or mnemonic
npm run evm:forge:merkle
```

Set `YOHUALLI_MERKLE_REGISTRY` to the `0x…` printed. Verify: `cast code $YOHUALLI_MERKLE_REGISTRY` must be non empty. On Hub, if `CREATE` fails, do not call `setHonkVerifier` on an EOA: see `DeployYohualliMerkleHonkRegistry.s.sol` comments.

**C) Link Honk to the registry (once) —** **owner** only (same as registry deployer).

```bash
export YOHUALLI_MERKLE_REGISTRY=0x…
export HONK_VERIFIER_ADDRESS=0x…
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
npm run evm:forge:merkle:set-honk
```

For `setMerkleRoot`, you can use `bash scripts/forge-merkle-set-root.sh` with `MERKLE_ROOT`, `MERKLE_EPOCH` (optional), and credentials in the environment or `.env.forge.local` plus `yarn yoh:toolbox run …`.

### 3. Set merkle root for an epoch

**Owner** only. The **bytes32** must be the one corresponding to the proof (32 Fr of `merkle_root` as the contract packs them). Options: `cast send` with the ABI, or a minimal `forge` script. For the lab prover sample (`YOHUALLI_LAB_MERKLE_ROOT` or the v1 script default), use that root and an agreed `epoch` (e.g. 0 or 1).

### 4. PWA: local env (Vite) — no secrets in VITE

Copy [`.env.example`](../.env.example) to **`.env.local`** (not committed on git). For deploy: copy [`.env.forge.example`](../.env.forge.example) to **`.env.forge.local`**, and use `yarn yoh:toolbox run <script>`. See [ENV_SAFETY.md](ENV_SAFETY.md). Restart `yarn dev` when Vite env changes.

```env
# .env.local
VITE_PASEO_VERIFIER_ADDRESS=0x…
VITE_PASEO_MERKLE_REGISTRY_ADDRESS=0x…
# optional: VITE_PASEO_RPC_URL, VITE_PASEO_CHAIN_ID, VITE_PASEO_EXPLORER_URL
```

### 5. ZK Lab (client verify)

1. Load proof + 128 public rows (v1 Merkle attest) or the Merkle v1 sample.  
2. `merkleFieldStart` = **96** (current v1 layout).  
3. Run **Verify (Honk)** with the verifier address (or from env).  
4. **Verify (verify for epoch)** with the registry, using `VITE_PASEO_MERKLE_REGISTRY_ADDRESS` (or paste manually).

### 6. Done criteria

- [ ] `cast code` on verifier and registry is not empty.  
- [ ] `setHonkVerifier` executed.  
- [ ] `setMerkleRoot(epoch, root)` matches the proof root.  
- [ ] `verify` and `verifyForEpoch` work from ZK Lab or `cast call`.

**Related:** [YOHUALLI_MERKLE_PROOF_V0.md](./YOHUALLI_MERKLE_PROOF_V0.md), [YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md](./YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md), [CIRCUITS_LAB.md](./CIRCUITS_LAB.md).

---

## Español (América Latina)

**Objetivo:** un **registry** fijo con `HonkVerifier` v1 (*Merkle attest*), **root** por *epoch* alineado con las pruebas, y la PWA (ZK Lab) con **variables** de entorno. **Nunca** pongas *deploy keys* bajo el prefijo `VITE_` (ver [ENV_SAFETY.md](ENV_SAFETY.md) y *toolbox*).

### Prerrequisitos

- Cuenta con **PAS** (o gas de la testnet) en la **misma** clave que va a ser **owner** de `YohualliMerkleHonkRegistry` (p. ej. EOA en `m/44'/60'/0'/0/0` de fondeo).
- **RPC** de la EVM: por defecto en la PWA: `https://eth-rpc-testnet.polkadot.io` o el que usen; `cast` y `forge` **tienen** que usar el **mismo** URL.
- **VK** y `HonkVerifier.sol` alineados con el circuito desplegado (`yohualli_merkle_attest_v1` y `verifier:sync:honk:merkle-v1`).

### 1. Variables de shell (Foundry)

| Variable | Uso |
|----------|-----|
| `RPC_URL` | URL del nodo; obligatoria en los `npm run evm:forge:*` del `package.json` (raíz). |
| `PRIVATE_KEY` | `0x…` de la cuenta que despliega, **o** |
| `MNEMONIC` + `ACCOUNT_INDEX` | Misma derivación que `DeployHonkVerifier` (índice 0 = primera cuenta tipo MetaMask). |
| `HONK_VERIFIER_ADDRESS` | p. ej. v1 Merkle: `0x9D098225B1C375F95576047C6D6F0252126CaFE6`; no reutilices un v0 p. ej. `0xcc6d…` con pruebas v1 (128 públicos). |
| `YOHUALLI_MERKLE_REGISTRY` | Después del paso 2. |

### 2. Desplegar o reutilizar

**A) `HonkVerifier` (si aún no está en testnet)**

```bash
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
# export PRIVATE_KEY=0x…   o   export MNEMONIC="…" && export ACCOUNT_INDEX=0
npm run evm:forge:honk
```

Anotar la dirección impresa: `HONK_VERIFIER_ADDRESS`.

**B) `YohualliMerkleHonkRegistry` (solo `CREATE`)**

```bash
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
# misma credencial que arriba
npm run evm:forge:merkle
```

Anotar `YohualliMerkleHonkRegistry: 0x…` y exportar con `YOHUALLI_MERKLE_REGISTRY`.

**Comprobar** despliegue real:

```bash
cast code $YOHUALLI_MERKLE_REGISTRY   # no debe ser 0x vacío
```

En Hub/Revive, si el `CREATE` falla, **no** llames a `setHonkVerifier` sobre una EOA: comentarios en `DeployYohualliMerkleHonkRegistry.s.sol`.

**C) Enlazar Honk al *registry* (una sola vez).** Solo el **owner** (mismo `msg.sender` del `CREATE`).

```bash
export YOHUALLI_MERKLE_REGISTRY=0x…
export HONK_VERIFIER_ADDRESS=0x…
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
npm run evm:forge:merkle:set-honk
```

Tras esto, `setHonkVerifier` no puede repetirse (`HonkAlreadySet` salvo *redeploy* de *registry*). Alternativa para *root* `setMerkleRoot`: `bash scripts/forge-merkle-set-root.sh` (variables `RPC_URL`, `YOHUALLI_MERKLE_REGISTRY`, `MERKLE_ROOT`, *etc.*) y *toolbox* con `.env.forge.local`.

### 3. Fijar `merkleRoot` en un *epoch*

Solo **owner**. El **mismo** `bytes32` que tengan los **públicos** de la prueba (32 `Fr` de `merkle_root` empaquetables con el *contrato*). Opciones: *cast* o *forge script* que llame `setMerkleRoot(epoch, root)`.

Para el **laboratorio**: la muestra del *prover* (`YOHUALLI_LAB_MERKLE_ROOT` o el *default* del *script* v1), usa **ese** root y un *epoch* acordado (p. ej. 0 o 1).

### 4. PWA: *local* (Vite) — sin *secretos* bajo `VITE_`

- Copia [`.env.example`](../.env.example) a **`.env.local`** (no a git) y ajusta direcciones.
- *Deploy* (`RPC_URL`, `PRIVATE_KEY` o *mnemónica*): copia [`.env.forge.example`](../.env.forge.example) a **`.env.forge.local`** y usa `yarn yoh:toolbox run <script>`. [ENV_SAFETY.md](ENV_SAFETY.md)

```env
# .env.local
VITE_PASEO_VERIFIER_ADDRESS=0x…
VITE_PASEO_MERKLE_REGISTRY_ADDRESS=0x…
# opcionales: VITE_PASEO_RPC_URL, VITE_PASEO_CHAIN_ID, VITE_PASEO_EXPLORER_URL
```

Reiniciar `yarn dev` al cambiar variables *Vite*.

### 5. ZK Lab (verificar en *client*)

1. Cargar prueba y **128** filas *públicas* (v1 *Merkle*) o *cargar muestra* v1.  
2. `merkleFieldStart` = **96** (*layout* actual v1).  
3. **Verificar (Honk)** con la *address* *del* *verificador* (o la del *env*).  
4. **Verificar (verify for epoch)** con *registry*; `VITE_PASEO_MERKLE_REGISTRY_ADDRESS` o pega a mano.

### 6. Cierre

- [ ] *cast code* *no vacío* en *verificador* y *registry*  
- [ ] `setHonkVerifier` ejecutado  
- [ ] `setMerkleRoot(epoch, root)` coincide con *root* *de* *la* *prueba*  
- [ ] `verify` y `verifyForEpoch` *OK* *desde* *ZK* *Lab* o *cast*  

### Documentos relacionados

- [YOHUALLI_MERKLE_PROOF_V0.md](./YOHUALLI_MERKLE_PROOF_V0.md) — *qué* *prueba* hoy *v*1 *vs* *inclusión* (siguiente)  
- [YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md](./YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md) — *espec* *siguiente* `main.nr`  
- [CIRCUITS_LAB.md](./CIRCUITS_LAB.md) — *scripts* y *`verifier:sync:honk:merkle-v1`*
