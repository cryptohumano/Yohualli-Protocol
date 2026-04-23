# Circuitos ZK en el repositorio (laboratorio)

**Inglés (resumen en paralelo):** [CIRCUITS_LAB.en.md](CIRCUITS_LAB.en.md) — **política de idiomas:** [protocol-docs-languages.md](protocol-docs-languages.md)

Este documento resume **qué hay implementado en código** respecto a circuitos Noir / Barretenberg y la **documentación de protocolo** donde se describe el diseño completo (no implementado al 100 % en la PWA). **Criterio de PoC** (prover en PWA *vs* generación *fuera* del *browser*): [YOHUALLI_POC_PWA_PROVER_DILEMMA.md](YOHUALLI_POC_PWA_PROVER_DILEMMA.md).

## Código: `circuits/` (Noir en el repo)

| Directorio / paquete | Rol |
|----------------------|-----|
| [`circuits/square/`](../circuits/square/) | Circuito tutorial `x * x = y` (muestra embebida en la PWA). |
| [`circuits/yohualli_subject_commitment_v0/`](../circuits/yohualli_subject_commitment_v0/) | Apertura del *subject commitment* v0: `keccak256(0x01 || pk)` con `pk` **privado** (32 B) y `subject_commitment` **público**; dependencia `keccak256` (Noir). **32** `bytes32` de públicos; sin ECDSA (prover en PWA/Worker razonable). Copiar artefacto: `npm run circuit:copy-artifact:subject-commitment-v0` tras `nargo compile`. |
| [`circuits/yohualli_one_attest_sig/`](../circuits/yohualli_one_attest_sig/) | **v0 mínimo:** una verificación **ECDSA secp256k1** sobre un digest de 32 bytes (`std::ecdsa_secp256k1::verify_signature`), alineado con firmar el hash final de [EIP-712 v0](YOHUALLI_ATTESTATION_SIGNING_V0.md) con la EOA de atestación. `Prover.toml` de lab: `node scripts/gen-yohualli-one-attest-prover.mjs`. Tras `nargo compile`, `bb gates` reporta un `circuit_size` de orden **~4.3e4** (esquema `ultra_honk` con expansión de la primitiva ECDSA). |
| [`circuits/yohualli_merkle_attest_v1/`](../circuits/yohualli_merkle_attest_v1/) | **v1:** mismo ECDSA + `merkle_root: pub [u8; 32]` (32 Fr consecutivos en la salida de `bb prove`) para alinear con `YohualliMerkleHonkRegistry.verifyForEpoch` (empaquetado on-chain de esos 32 Fr a un `bytes32`). Prover de lab: `npm run circuit:prover:yohualli-merkle-v1`; probar: `nargo execute` + `bb prove … -t evm`; copiar verificador: `npm run verifier:sync:honk:merkle-v1`. Públicos: **128** filas `bytes32` en ZK Lab. |

## Despliegue EVM: `evm/yohualli_honk_verifier/` (Foundry)

| Elemento | Rol |
|----------|-----|
| [`evm/yohualli_honk_verifier/`](../evm/yohualli_honk_verifier/) | Proyecto **Foundry** con el `HonkVerifier` generado por `bb write_solidity_verifier` (copiado con [`scripts/sync-honk-verifier-solidity.sh`](../scripts/sync-honk-verifier-solidity.sh)). `forge build` y `script/DeployHonkVerifier.s.sol` para publicar en **Polkadot Hub testnet** (o otra EVM). Variable de entorno de la PWA: `VITE_PASEO_VERIFIER_ADDRESS`. |
| Públicos | Con `yohualli_merkle_attest_v1` (verificador por defecto en el repo): **128** `bytes32` a `verify` (el `.sol` generado fija el tamaño; no mezclar con pruebas del v0 de 96 filas). v0 `yohualli_one_attest_sig`: 96 filas. Desde la raíz: `npm run circuit:proof-hex:yohualli-merkle-v1` + `npm run circuit:public-inputs:yohualli-merkle-v1`, o muestra embebida v1. |

## Código: `src/circuits/`

| Archivo | Rol |
|---------|-----|
| [`honkVerifierAbi.ts`](../src/circuits/honkVerifierAbi.ts) | ABI mínima del contrato `HonkVerifier` (`verify`) para llamadas `readContract` desde la PWA. |
| [`encodeProof.ts`](../src/circuits/encodeProof.ts) | Normalización de prueba hex y parseo de públicos (`bytes32` por línea) para el verificador. |
| [`kusamaNoirLabSample.ts`](../src/circuits/kusamaNoirLabSample.ts) | Carga embebida de la prueba **square** (x²=y, x=3, y=9) y públicos desde `samples/` (`?raw`). |
| [`yohualliOneAttestLabSample.ts`](../src/circuits/yohualliOneAttestLabSample.ts) | Carga embebida v0: 96 filas. |
| [`yohualliMerkleAttestV1LabSample.ts`](../src/circuits/yohualliMerkleAttestV1LabSample.ts) | Carga embebida v1: 128 filas; constante `YOHUALLI_MERKLE_ATTEST_V1_MERKLE_FR_START = 96` (inicio del bloque Merkle en los públicos). |
| `yohualliMerkleV1Prove.worker.ts` + `yohualliMerkleV1WorkerClient.ts` | Prover en **Web Worker**: Noir (`@noir-lang/noir_js`) + Barretenberg (`@aztec/bb.js`, prueba con `keccak: true` para EVM), inputs de lab alineados con el script de `Prover.toml`. |
| [`artifacts/yohualli_merkle_attest_v1.json`](../src/circuits/artifacts/yohualli_merkle_attest_v1.json) | Copia del `target/…/yohualli_merkle_attest_v1.json` tras `nargo compile` (Vite no importa `circuits/` fuera de `src/`). Actualizar con `npm run circuit:copy-artifact:merkle-v1`. |
| [`artifacts/yohualli_subject_commitment_v0.json`](../src/circuits/artifacts/yohualli_subject_commitment_v0.json) | Copia de `yohualli_subject_commitment_v0` (apertura *keccak* v0). `npm run circuit:copy-artifact:subject-commitment-v0`. Prover PWA: `yohualliSubjectCommitmentV0ProveCore.ts` + worker. |
| `samples/square-*.hex`, `samples/yohualli-one-attest-*.hex` / `.txt` | Muestras embebidas; la Yohualli debe regenerarse con los scripts npm si el circuito o el witness de lab cambian. |

Fuentes Noir (`.nr`) viven bajo `circuits/`; la PWA compila y empaqueta el **prover** (WASM) para v1; el hilo de UI no ejecuta el circuito: solo el **worker** y, aparte, **verificación read-only** on-chain. El build incluye Chunks grandes (`@aztec/bb.js` + `.wasm`); el precache de la PWA crece (orden de 10+ MB) — aceptable para medir en dispositivo real; se puede excluir del precache o cargar bajo demanda en iteraciones futuras.

Lógica compartida en `yohualliMerkleV1ProveCore.ts` con `backend: BackendType.Wasm` (WASM en el hilo de ejecución), `memory: { initial: 1024, maximum: 2**16 }` y `CircuitOptions` `{ recursive: true }` (alineado con `keccakZK` y `acirInitSRS` / `disableZk: !recursive` en `@aztec/bb.js`). El ZK Lab ofrece prover en **Web Worker** o en **hilo principal** (menos aislado, a veces más estable si el stack falla en worker). **No** abrís el lab solo por el proxy de vista embebida del IDE (p. ej. `https://localhost:64926/…` → a veces `ERR_EMPTY_RESPONSE` o WASM con base URL mala; usá el origen del `yarn dev` con su **puerto real**). Si aun falla, `bb prove` en CLI; ECDSA completo en navegador sigue al límite.

**`Length is too large` en `@aztec/bb.js` (Barretenberg en navegador):** el módulo JS reserva búferes fijos (serie **8 MiB**) para entrada/salida msgpack con el WASM; circuitos con keccak u Honk con muchos públicos pueden superarlo. El `postinstall` fija hoy **256 MiB** por defecto (`scripts/patch-aztec-bb-msgpack-scratch.mjs`, reemplazando cualquier valor previo del *scratch* en `node_modules/…/barretenberg_wasm_main/index.js`); bajar con `BB_MSGPACK_MB` (8–**256** máx., p. ej. 128) antes del script en dispositivos con poca RAM. En `yarn dev` / `yarn build`, el plugin de Vite (`barretenbergMsgpackVitePlugin` en `vite.config.ts`) reescribe `barretenberg_wasm_main` con **`load` + `transform`**, `Cache-Control: no-store` en el dev server para `@aztec/bb.js` (evita caché con `?v=…` distintos) y el `id` del módulo se limpia de `?#`; variable **`BB_MSGPACK_VITE_MIB`** (8–256, por **defecto 256** en Vite salvo `process.env`; alineado con el `postinstall` salvo bajes `BB_MSGPACK_MB` en instalaciones ajustadas a memoria). Comprobá en consola al arrancar: `[Vite] @aztec/bb.js msgpack scratch: …`. Tras `yarn install` a una nueva versión de `@aztec/bb.js`, relanzá el *patch*; reiniciá Vite, recargá dura o probá en incógnito. Si aun falla, `bb prove` en CLI o subí ligeramente el límite (p. ej. 192) o revisá memoria en el dispositivo.

**Ese mismo texto de error (junto a `sublimb of low too large` en el `.wasm`) puede ser *bigfield* o un **desalineo `disableZk` init vs prove**, no I/O msgpack:** con `keccak: true` el `prove` pone `disableZk: true`; con `keccakZK: true` el `prove` pone `disableZk: false`, pero `acirInitSRS` / `circuitStats` usan `disableZk: !recursive` — si el `UltraHonkBackend` se instancia con `recursive: false` (por defecto), el **init** queda con `disableZk: true` y el **prove** con `keccakZK` con `false`, y el prover en WASM puede volver a fallar. Usar `recursive: true` en el constructor (ver `ULTRA_HONK_BACKEND_CIRCUIT_OPTIONS` en `src/circuits/bbUltraHonkEvmOptions.ts`) y alinear `bb prove` / `bb write_solidity_verifier` con la misma `ProofSystemSettings` on-chain.

## UI: ZK Lab

[`ZkLab.tsx`](../src/pages/ZkLab.tsx) — ruta `/zk-lab`: wallet EVM (PassetHub), carga de muestra, campos de prueba/públicos y `verify` vía **viem** (`eth_call`).

## Documentación de protocolo (Noir / ZK en Yohualli)

| Documento | Contenido |
|-----------|------------|
| [`Yohualli Protocol draft 1.1.md`](./Yohualli%20Protocol%20draft%201.1.md) | Diseño: circuitos Noir, verificadores, VRF, commitments, integración EVM/Ink!, etc. |
| [`YOHUALLI_ACERCAMIENTO_WHITEPAPER.md`](./YOHUALLI_ACERCAMIENTO_WHITEPAPER.md) | Orden de trabajo hacia una versión de prueba (código + circuitos + contrato mínimo). |
| [`YOHUALLI_EVM_CONTRACTS_ARCHITECTURE.md`](./YOHUALLI_EVM_CONTRACTS_ARCHITECTURE.md) | Decisiones de arquitectura para contratos (ECDSA, BIP44, `msg.sender` vs prueba). |
| [`YOHUALLI_MERKLE_PROOF_V0.md`](./YOHUALLI_MERKLE_PROOF_V0.md) | Criterio de hoja/deduplicación en relay, registro `merkleRoot` por epoch, wrapper `require(root) + verify`, y **qué prueba hoy** el circuito Yohualli (v1: ECDSA + `merkle_root` sin path). **Pruebas:** se generan con `bb` en dev; la PWA no es prover. |
| [`YOHUALLI_TESTNET_OPERATIVO.md`](./YOHUALLI_TESTNET_OPERATIVO.md) | Checklist: desplegar `YohualliMerkleHonkRegistry`, `setHonkVerifier`, `setMerkleRoot`, variables `.env` y ZK Lab. |
| [`YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md`](./YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md) | **Siguiente** circuito (no implementado): Merkle con path en constraints; decisiones a congelar (hash, profundidad, hoja). |
| `evm/yohualli_honk_verifier/` (contratos extra) | `YohualliMerkleHonkRegistry.sol` (despliegue en un `CREATE`); módulos `MerkleRootRegistry` + `YohualliHonkGateway` para tests. Ver README del paquete. |
| [`YOHUALLI_ATTESTATION_SIGNING_V0.md`](./YOHUALLI_ATTESTATION_SIGNING_V0.md) | EIP-712: dominio y struct de atestación v0. |
| [`yohualli-tier-sybilrank-matematica.md`](./yohualli-tier-sybilrank-matematica.md) | **No** es circuito ZK: es el PageRank de laboratorio en `src/social-graph/`; se enlaza porque el borrador contrasta con SybilRank “completo” on-chain/ZK. |

## Qué se eliminó (solc en el navegador)

Anteriormente ZK Lab incluía compilación **solc-js** en un Web Worker y despliegue de un contrato de prueba. Ese flujo dependía de `solc` (~10 MB WASM) y de `src/lib/evm/*` + `src/workers/solcCompile.worker.ts`. **Ya no forma parte del proyecto**: el verificador se compila y despliega con herramientas locales (p. ej. Foundry en el repo EVM del laboratorio Noir).
