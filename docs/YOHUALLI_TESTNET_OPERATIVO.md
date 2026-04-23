# Testnet: checklist operativo (Polkadot Hub EVM + Yohualli)

Objetivo: **registry fijo** con `HonkVerifier` v1 (Merkle attest), **root por epoch** alineado con pruebas, y PWA (ZK Lab) con variables de entorno.

## Prerrequisitos

- Cuenta con **PAS** (o gas de la testnet) en la misma clave que vaya a ser **owner** del `YohualliMerkleHonkRegistry` (p. ej. EOA `m/44'/60'/0'/0/0` de fondeo).
- **RPC** de la EVM: por defecto en PWA `https://eth-rpc-testnet.polkadot.io` o el que uséis; `cast` / `forge` **debén** usar el mismo.
- **VK** y `HonkVerifier.sol` en el repo alineados con el circuito desplegado (`yohualli_merkle_attest_v1` + `verifier:sync:honk:merkle-v1`).

## 1. Variables de shell (Foundry)

| Variable | Uso |
|----------|-----|
| `RPC_URL` | URL del nodo (obligatoria en los `npm run evm:forge:*` del `package.json`). |
| `PRIVATE_KEY` | `0x…` de la cuenta que despliega, **o** |
| `MNEMONIC` + `ACCOUNT_INDEX` | derivación como en `DeployHonkVerifier` (índice 0 = primera cuenta tipo MetaMask). |
| `HONK_VERIFIER_ADDRESS` | `0x…` del `HonkVerifier` alineado con el circuito (v1 Merkle: p. ej. `0x9D098225B1C375F95576047C6D6F0252126CaFE6`; **no** reutilices un Honk v0 p. ej. `0xcc6d…` con pruebas v1 de 128 públicos). |
| `YOHUALLI_MERKLE_REGISTRY` | `0x…` del `YohualliMerkleHonkRegistry` **después** del paso 2. |

## 2. Desplegar o reutilizar contratos

### A) `HonkVerifier` (si aún no está en testnet)

```bash
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
# export PRIVATE_KEY=0x…   o   export MNEMONIC="…" && export ACCOUNT_INDEX=0
npm run evm:forge:honk
```

Anotar la dirección impresa → `HONK_VERIFIER_ADDRESS`.

### B) `YohualliMerkleHonkRegistry` (solo `CREATE`)

```bash
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
# misma credencial que arriba
npm run evm:forge:merkle
```

Anotar `YohualliMerkleHonkRegistry: 0x…` → `YOHUALLI_MERKLE_REGISTRY`.

**Comprobar** que hubo despliegue real:

```bash
cast code $YOHUALLI_MERKLE_REGISTRY   # no debe ser 0x vacío
```

En Hub/Revive, si el `CREATE` falla, **no** llamar a `setHonkVerifier` sobre una EOA: ver comentarios en `DeployYohualliMerkleHonkRegistry.s.sol`.

### C) Enlazar Honk al registry (una sola vez)

Solo el **owner** del registry (en el deploy, el `msg.sender` del `CREATE`).

```bash
export YOHUALLI_MERKLE_REGISTRY=0x…   # del paso B
export HONK_VERIFIER_ADDRESS=0x…     # del paso A o el que uses
export RPC_URL='https://eth-rpc-testnet.polkadot.io'
npm run evm:forge:merkle:set-honk
```

Tras esto, `setHonkVerifier` **no** puede repetirse (revert `HonkAlreadySet` salvo redeploy de registry).

## 3. Fijar `merkleRoot` para un epoch

Solo `owner` del registry. **Mismo** `bytes32` que tengan los **públicos** de la prueba (bloque de 32 `Fr` del `merkle_root` empaquetable como hace el contrato).

Opciones:

- `cast send` con ABI del contrato, o
- `forge script` mínimo que llame `setMerkleRoot(epoch, root)`.

Para la **muestra de lab** del prover (`YOHUALLI_LAB_MERKLE_ROOT` o el default `0x22…22` en el script v1), usad **ese** root y un `epoch` acordado (p. ej. `0` o `1`).

## 4. PWA: entorno *local* (Vite) — sin *secretos* *en* `VITE_`

- Copiá [`.env.example`](../.env.example) a **`.env.local`** (no subir a git) y ajustad direcciones de *testnet*.
- Las credenciales de *deploy* (`RPC_URL`, `PRIVATE_KEY` o mnemónicas) **no** llevan prefijo `VITE_`. Copiá [`.env.forge.example`](../.env.forge.example) a **`.env.forge.local`** y usad `yarn yoh:toolbox run <script>`. Ver [ENV_SAFETY.md](ENV_SAFETY.md).

```env
# .env.local — solo público / direcciones
VITE_PASEO_VERIFIER_ADDRESS=0x…        # HonkVerifier (misma VK que la prueba)
VITE_PASEO_MERKLE_REGISTRY_ADDRESS=0x…  # YohualliMerkleHonkRegistry
# Opcionales: VITE_PASEO_RPC_URL, VITE_PASEO_CHAIN_ID, VITE_PASEO_EXPLORER_URL
```

Reiniciar `yarn dev` tras cambiar variables *Vite*.

## 5. ZK Lab (verificación en cliente)

1. Cargar prueba + **128** filas de públicos (v1 Merkle attest) o “Cargar muestra Merkle v1”.
2. `merkleFieldStart` = **96** (v1 con layout actual).
3. Probar **Verificar (Honk)** con la dirección del verificador (o la prellenada por env).
4. Mismo `epoch` y registro: **Verificar (verify for epoch)** con `VITE_PASEO_MERKLE_REGISTRY_ADDRESS` (o paste manual).

## 6. Cierre de criterio

- [ ] `cast code` del verificador y del registry no vacío.
- [ ] `setHonkVerifier` ejecutado; `HonkNotSet` no aplica.
- [ ] `setMerkleRoot(epoch, root)` = root de la prueba.
- [ ] `verify` y `verifyForEpoch` correctos desde ZK Lab o `cast call`.

## Documentos relacionados

- [`YOHUALLI_MERKLE_PROOF_V0.md`](./YOHUALLI_MERKLE_PROOF_V0.md) — qué prueba hoy el circuito v1 vs **inclusión** (siguiente circuito).
- [`YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md`](./YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md) — spec del **siguiente** `main.nr`.
- [`CIRCUITS_LAB.md`](./CIRCUITS_LAB.md) — scripts `npm run circuit:*` y `verifier:sync:honk:merkle-v1`.
