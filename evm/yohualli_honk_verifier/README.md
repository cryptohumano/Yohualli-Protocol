# Verificador Honk (Yohualli)

Contrato **Solidity** generado por Barretenberg (`bb write_solidity_verifier`). **Por defecto en el repo** el origen es `circuits/yohualli_merkle_attest_v1/` (ECDSA + `merkle_root` público); el flujo antiguo `yohualli_one_attest_sig` sigue en su directorio. Expone `verify(bytes proof, bytes32[] publicInputs) view returns (bool)` (tamaño de `publicInputs` fijado por la VK). ZK Lab: [`src/circuits/honkVerifierAbi.ts`](../../src/circuits/honkVerifierAbi.ts).

**PVM (PolkaVM / resolc + `solc` front-end):** despliegue y compile separados en [`../polkadot_pvm`](../polkadot_pvm) con Hardhat; `forge` sigue para la pila EVM/REVM abajo.

## Regenerar `HonkVerifier.sol` (v1 Merkle + ECDSA)

```bash
node scripts/gen-yohualli-merkle-attest-v1-prover.mjs
cd circuits/yohualli_merkle_attest_v1
nargo compile && nargo execute
bb prove -b target/yohualli_merkle_attest_v1.json -w target/yohualli_merkle_attest_v1.gz -o target/proof -t evm --write_vk
bb write_solidity_verifier -k target/proof/vk -o target/Verifier.sol -t evm
cd ../.. && bash scripts/sync-honk-verifier-merkle-v1.sh
cd evm/yohualli_honk_verifier && forge build
```

**v0** (solo `yohualli_one_attest_sig`): `bash scripts/sync-honk-verifier-solidity.sh` tras `bb` en `circuits/yohualli_one_attest_sig/` (ver historial en git).

## Compilar (Foundry)

```bash
cd evm/yohualli_honk_verifier
forge build
```

## Desplegar (Polkadot Hub testnet u otra EVM)

Necesitás gas en la cuenta y **definir la clave** en el mismo shell que `forge` (o con `source` a un `.env` local, no commiteado).

### Opción A — mnemónico (BIP-39) + derivación

El script usa el cheat `vm.deriveKey` de Foundry:

- Sin `ACCOUNT_DERIVATION_PATH`, la ruta es la estándar EVM `m/44'/60'/0'/0/{ACCOUNT_INDEX}` (p. ej. `ACCOUNT_INDEX=0` = primera cuenta “tipo MetaMask”).

```bash
cd evm/yohualli_honk_verifier
export MNEMONIC="word1 word2 ... word12"
export ACCOUNT_INDEX=0
forge script script/DeployHonkVerifier.s.sol:DeployHonkVerifier \
  --rpc-url "https://eth-rpc-testnet.polkadot.io" \
  --broadcast
```

Ruta custom (el índice final se toma de `ACCOUNT_INDEX` y se concatena a `ACCOUNT_DERIVATION_PATH` según el comportamiento de `deriveKey` en Foundry):

```bash
export ACCOUNT_DERIVATION_PATH="m/44'/60'/0'/0/"
export ACCOUNT_INDEX=0
```

También podés poner en `MNEMONIC` la **ruta a un fichero** con las palabras (lo soporta `deriveKey`).

### Opción B — clave privada

```bash
export PRIVATE_KEY=0x...   # hex con 0x o decimal; no commitear
forge script script/DeployHonkVerifier.s.sol:DeployHonkVerifier \
  --rpc-url "https://eth-rpc-testnet.polkadot.io" \
  --broadcast
```

Si `MNEMONIC` está vacío, el script usa `PRIVATE_KEY`.

**EVM / PUSH0 (EIP-3855):** en `foundry.toml` usamos `evm_version = "paris"` para no emitir el opcode `PUSH0` (Shanghai). El RPC aún puede mostrar *“EIP-3855 is not supported”* para el chain id 420420417: es un aviso de compatibilidad, no implica que el artefacto lleve `5f` si recompilaste con este `foundry.toml`.

- Si `forge` dijo *“compilation skipped”* y luego el `CREATE` falla on-chain, hacé **`forge clean && forge build`** (o dejá que `npm run evm:forge:merkle` ejecute al menos `forge build`, como ahora) para no desplegar bytecode en caché con otra `evm_version`.
- **`-g 500`** en los `npm run evm:forge:*` = multiplicador de gas **5×** frente a la estimación (default Foundry = 1,3×). En Revive a veces el límite quedaba bajo y el recibo mostraba poco `gasUsed` y `status:0`.

Anotá la dirección del `HonkVerifier` y pégala en el build de la PWA: `VITE_PASEO_VERIFIER_ADDRESS=0x...`

### Actualizar a VK `yohualli_merkle_attest_v1` (p. ej. reemplazar el Honk v0 de Paseo)

1. Regenerar y copiar el contrato: `npm run verifier:sync:honk:merkle-v1` (requiere `circuits/yohualli_merkle_attest_v1/target/Verifier.sol` de `nargo` + `bb write_solidity_verifier`; ver sección de arriba).
2. Desplegar el nuevo `HonkVerifier`: `export RPC_URL=...` y `export PRIVATE_KEY=0x...` o `MNEMONIC` + `ACCOUNT_INDEX`, luego `npm run evm:forge:honk`. Anotá `NEW_HONK`.
3. **Registry ya desplegado con `setHonkVerifier` usado (honk fijado, p. ej. 0xcc6d):** el bytecode antiguo no tenía `replaceHonkVerifier`. Con el **mismo** owner, desplegá un `YohualliMerkleHonkRegistry` **nuevo** con este repo (`npm run evm:forge:merkle`), luego:
   - `export YOHUALLI_MERKLE_REGISTRY=<nuevo>`, `export HONK_VERIFIER_ADDRESS=<NEW_HONK>`, `npm run evm:forge:merkle:set-honk`
   - `export RPC_URL=https://eth-rpc-testnet.polkadot.io` (obligatorio: sin `RPC_URL` Forge falla con *fork-url* u otro error opaco), `export MERKLE_ROOT=…` (p. ej. salida de `npm run merkle:root:trusted-seed-leaves` en la raíz del monorepo), `export YOHUALLI_MERKLE_REGISTRY=0x…`, `export MERKLE_EPOCH=0` si aplica, `npm run evm:forge:merkle:set-root` (usa `scripts/forge-merkle-set-root.sh` y avisa si falta algo)
4. **Registry con bytecode de este repo (incluye `replaceHonkVerifier`):** el owner puede `npm run evm:forge:merkle:replace-honk` con `HONK_VERIFIER_ADDRESS=<NEW_HONK>` sin redesplegar el registry.
5. PWA: `VITE_PASEO_VERIFIER_ADDRESS` y `VITE_PASEO_MERKLE_REGISTRY_ADDRESS` a las direcciones nuevas; reiniciar `npm run dev`.

## `YohualliMerkleHonkRegistry` (corte v0: 1er comando = `CREATE`, 2.º = `setHonkVerifier` si hay bytecode)

Contrato unificado: **registro** `merkleRoot(epoch)` (propietario = trusted seed / multisig a futuro) y **gateway** hacia el `HonkVerifier` — `verify` y `verifyForEpoch` (root en públicos cuando el circuito lo tenga; el circuito ECDSA mínimo solo usa `verify`).

`MerkleRootRegistry.sol` + `YohualliHonkGateway.sol` siguen en `src/` para pruebas Foundry. En **testnets Revive/Frontier (Polkadot Hub)** a veces el `CREATE` de este contrato falla on-chain con `status:0` y ~`10e3` de `gasUsed` mientras `cast run` del mismo `input` en el RPC reproduce el bloque con éxito.

- **1)** `npm run evm:forge:merkle` = solo `new YohualliMerkleHonkRegistry()`.
- **2)** `cast code <dirección>`: si el resultado es `0x`, no hay despliegue; **no** pases a (3).
- **3)** Si hay bytecode: `YOHUALLI_MERKLE_REGISTRY=0x…`, `HONK_VERIFIER_ADDRESS=0x…` y `npm run evm:forge:merkle:set-honk`.

**Aviso:** en el mismo bloque, una `CALL` a la dirección predicha puede quedar con `status:1` y poco `gas` **sin que exista contrato**; comprobad siempre con `cast code`. Hasta enlazar al `HonkVerifier`, `verify` / `verifyForEpoch` hacen revert con `HonkNotSet()`.

**Variables reales, no `...`:** p. ej. `export RPC_URL=https://eth-rpc-testnet.polkadot.io`.

**Directorio actual:** si ya estás en `.../aura-pwa-zk/evm`, hacé `cd yohualli_honk_verifier` (no `cd evm/...` otra vez).

#### Despliegue (raíz del repo, recomendado)

```bash
# ~/aura-pwa-zk
export RPC_URL=https://eth-rpc-testnet.polkadot.io
export MNEMONIC="…"   # o PRIVATE_KEY=0x…
npm run evm:forge:merkle
# cast code <YohualliMerkleHonkRegistry> — si no es 0x, entonces:
export HONK_VERIFIER_ADDRESS=0xfd706194f4F68DE6C7dA84CCcbB40FDe716AA4F7
export YOHUALLI_MERKLE_REGISTRY=0x…
npm run evm:forge:merkle:set-honk
```

La variable de entorno se llama `HONK_VERIFIER_ADDRESS` y su **valor** debe ser un address en **hex 0x + 40 caracteres** (el `HonkVerifier` desplegado con `npm run evm:forge:honk` o uno que ya exista on-chain). Si no hiciste `export` en esa misma terminal, el valor queda vacío y verás `invalid string length` o un `revert` con el mensaje que añade el script. Los `export` solo viven en la **sesión actual** del shell.

Despliegue: `script/DeployYohualliMerkleHonkRegistry.s.sol`. Enlace: `SetYohualliMerkleRegistryHonk.s.sol`.

**Raíz a partir de trusted seeds (hojas = `subjectCommitment` v0):** en la raíz del monorepo, `npm run merkle:root:trusted-seed-leaves` (lee `TRUSTED_SEED_SS58` o `VITE_LAB_TRUSTED_SS58` y devuelve un `MERKLE_ROOT` listo para `setMerkleRoot` / `YOHUALLI_MERKLE_PROOF_V0.md` §2). No añade un contrato nuevo: reutiliza este mismo `YohualliMerkleHonkRegistry`.

**`forge script` y `--gas-estimate-multiplier`:** el flag usa **por ciento sobre 100** (p. ej. el default de Foundry es `130` ≈ 1,3×; `200` = 2×, `1000` = 10×). Nunca uses `2` pensando en “2×” — con `2` aplicas **2%** y el límite de gas queda ridículo; el nodo (Substrate) puede devolver `1010 Invalid transaction` o `1012` por intentos con TX inválidas. Si hace falta margen en Revive, pasá p. ej. `forge script ... -g 300` (3×) a mano.

#### Manual (estando en `evm/yohualli_honk_verifier/`)

```bash
forge script script/DeployYohualliMerkleHonkRegistry.s.sol:DeployYohualliMerkleHonkRegistry \
  --rpc-url "$RPC_URL" --broadcast
# Luego, si `cast code` de la address devuelve bytecode:
forge script script/SetYohualliMerkleRegistryHonk.s.sol:SetYohualliMerkleRegistryHonk \
  --rpc-url "$RPC_URL" --broadcast
```

Tests: `forge test` (`test/MerkleGateway.t.sol` cubre módulo dual y el contrato combinado). Ver `docs/YOHUALLI_MERKLE_PROOF_V0.md` y el ABI en `src/circuits/yohualliGatewayAbi.ts`.

**Pruebas Barretenberg:** se generan con `nargo` + `bb prove` en el entorno de desarrollo, **no** en el navegador; la PWA hoy solo **verifica** (`eth_call`).

## Depurar `CREATE` (YohualliMerkleHonkRegistry falla, `cast run` ok)

- **EIP-3855 / `PUSH0`:** contar `5f` en el hex del artifact: el `HonkVerifier` en la misma red tiene decenas de `PUSH0` y despliega; un solo `5f` en el Merkle no explica el fallo por “no Shanghai”.
- **Diferencias Revive vs EVM “puro”:** [Differences to EVM (resolc/revive)](https://paritytech.github.io/revive/user_guide/differences.html) documenta un modelo de despliegue distinto en **pallet-revive** con el compilador **revive**; aquí usás **solc+Foundry** como con el `HonkVerifier` (mismo enfoque). Véase además [issue #11525](https://github.com/paritytech/polkadot-sdk/issues/11525) (cadenas de llamadas / CREATE2 que divergen en pallet vs `eth_`).
- **Prueba mínima:** `npm run evm:forge:probe:create` despliega `HubCreateProbe` (contrato vacío, `src/HubCreateProbe.sol`). **Comprobado en testnet, bloque 7927286** (mismo `cast run` = éxito, recibo = `status:0`, ~891 `gas`, sin código en la dirección predicha): el fallo no es el bytecode de `YohualliMerkleHonkRegistry` sino *cualquier* `CREATE` vía EVM/Foundry ahora. El `HonkVerifier` desplegado pudo usarse otra vía o un runtime distinto. Siguiente paso: abrir hilo con el operador con hash + `input` (p. ej. `broadcast/DeployHubCreateProbe.s.sol/.../run-latest.json`).

## Si el despliegue falla

1. **Tamaño de contrato (EIP-170, 24 KiB):** con `optimizer_runs = 200` el `HonkVerifier` superaba el límite (~25,6 KiB) y el despliegue en cadena **rechaza** el CREATE. Este repo fija `optimizer_runs = 1`, `bytecode_hash = "none"` y `cbor_metadata = false` en `foundry.toml` para bajar el runtime por debajo del tope. Tras regenerar `HonkVerifier.sol`, volvé a compilar y comprobar:
   `forge build --sizes` (debe quedar `Runtime Margin` no negativo para `HonkVerifier`).

2. **Directorio:** el script vive en `evm/yohualli_honk_verifier/script/`. Hacé `cd` a esa carpeta (desde la raíz del repo: `cd evm/yohualli_honk_verifier`) antes de `forge script …`.

3. **Prueba de simulación sin broadcast:** `forge script …` sin `--broadcast` para ver logs; con `--broadcast` recién se envía a la red.

## Públicos on-chain

Este circuito declara **104** entradas públicas en la VK (`NUMBER_OF_PUBLIC_INPUTS` en el `.sol` generado). ZK Lab espera un `bytes32` por línea: para pruebas reales hay que convertir el fichero `public_inputs` binario de `bb prove` al formato que use la PWA (ver `src/circuits/encodeProof.ts`). El flujo *square* de ejemplo solo tenía un público; aquí hace falta un paso de conversión adicional o script.

## Versiones usadas al generar el contrato

- `nargo` / `noirc`: 1.0.0-beta.20 (ajustar si regenerás con otra toolchan)
- `bb`: 5.x con target `-t evm`
- `solc`: 0.8.28 (ver `foundry.toml`)
