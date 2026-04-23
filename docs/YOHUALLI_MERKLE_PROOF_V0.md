# Merkle, `epoch` y prueba ZK (spec v0 operativa)

Este documento acota **criterio de Merkle en el relay**, **anclaje on-chain** y la **relación con el `HonkVerifier`**, alineado con `YOHUALLI_ATTESTATION_SIGNING_V0.md` y `YOHUALLI_EVM_CONTRACTS_ARCHITECTURE.md`. Complementa el boceto amplio de `Yohualli Protocol draft 1.1.md` (MerkleRegistry, nullifiers) con el **estado del código** en el repositorio.

**Narrativa de producto (v1 “corta”):** grafo/score off-chain, *registry* = ancla de *epoch*; sin ZK de peso ni path en circuito — ver [YOHUALLI_FLUJO_PRODUCTO_CORTA.md](YOHUALLI_FLUJO_PRODUCTO_CORTA.md).

---

## 0. Definiciones: “registry fijo”, cierre del loop y “paths”

### 0.1. ¿Qué es el **registry fijo**?

No es un type distinto de contrato, sino una **decisión de despliegue y configuración** para un entorno (p. ej. testnet de demo):

- Un único despliegue concreto de `YohualliMerkleHonkRegistry` cuya **dirección** (`0x…`) vais a usar como verdad de referencia: `merkleRoot(epoch)` + puntero al `HonkVerifier` (`setHonkVerifier`).
- **Fijo** = “elegido y anotado” en `.env` / CI (`VITE_PASEO_MERKLE_REGISTRY_ADDRESS`) y en docs, para que **toda** prueba, relé y UI apunten al **mismo** `mapping(epoch => root)` y al **mismo** verificador, y no a un mezclado de contratos viejos/nuevos.
- Sigue pudiéndose **rotar** (nuevo `CREATE` o nuevo owner): entonces redefinís un nuevo “fijo” y actualizáis variables y Merkle oficiales.

**No** confundir: el *registry* es **EOA/owner**-gestionado; quien tenga `setMerkleRoot` / `owner` es quien fija el root por epoch, no el `HonkVerifier` (que solo hace aritmética de prueba).

### 0.2. Cómo **cerramos el loop** con el repo **hoy** (`yohualli_merkle_attest_v1`)

| Paso | Dónde |
|------|--------|
| 1) Acordar **epoch** y un **merkle root** (32 B) | Off-chain: batch/relé o lab (p. ej. hojas + árbol según §2). |
| 2) Generar la prueba con el circuito v1 | El `merkle_root` del witness/constraints que salen en `public_inputs` debe ser **el mismo** `bytes32` del paso 1 (empaquetado a 32 `Fr` como hace `bb` / ZK Lab). |
| 3) On-chain en el **registry fijo** | `setMerkleRoot(epoch, root)` (mismos `epoch` y `root` que 1 y 2). Opcional: `setHonkVerifier` si aún no enlazó la VK. |
| 4) Llamar `verifyForEpoch` | `merkleFieldStart` alineado con vuestro generador (v1: **96**; ver `CIRCUITS_LAB` / `yohualliMerkleAttestV1LabSample`). Compara 32 `Fr` consecutivos reempaquetados a `bytes32` con `merkleRoot[epoch]`, luego `honk.verify`. |

Eso **cierra el loop** entre “root que cree el registro on-chain” y “root que la prueba declara en públicos”.

**Qué **no** prueba aún** el `main.nr` v1: que exista una **hoja** bajo ese root, ni un **path** Merkle, ni un umbral de grafo. El circuito **solo** enlaza (con ECDSA) y publica un `merkle_root` *como valor*; la **membresía** hoja–árbol es hoy capa de **producto/relé** (construís un árbol cuyo root publicás on-chain) hasta que el circuito la incorpore.

### 0.3. Cómo **pasamos a merkle con paths** (siguiente corte cripto)

- **Idea:** el testigo (privado) incluye hoja, índice, **path** (hermanos por nivel) y, si aplica, reglas de padding/orden del árbol **congeladas** (§2).
- **Público:** al menos el `merkle_root` (y en muchos diseños el `subjectCommitment` de la hoja o un hash conectado a EIP-712) para conectar con `YohualliAttestationV0` **sin** subir el path a la cadena: solo entra al prover.
- **Noir:** reescribir `main` para verificar en constraints la función de hasheo nivel a nivel (p. ej. `keccak`/`poseidon` según spec) hasta alcanzar el `merkle_root` publicado. **Eso** es “Merkle con paths” en el sentido ZK: la **EVM nunca** recorre el árbol; solo hace `verify` + (en el registry) `root_on_chain == public_root`.
- Luego: nueva **VK** → `bb write_solidity_verifier` → desplegar/actualizar `Honk` en el registry, y actualizar PWA/embbeds con el **nuevo** despliegue y el orden de públicos.

Borrador de spec del siguiente circuito: [`YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md`](./YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md). Checklist testnet (deploy, `setMerkleRoot`, `.env`): [`YOHUALLI_TESTNET_OPERATIVO.md`](./YOHUALLI_TESTNET_OPERATIVO.md).

**Resumen de una frase:** *Registry fijo* = una **dirección** de `YohualliMerkleHonkRegistry` (y VK enlazada) a la que todos alinean `epoch` + `root` + prueba. *Loop cerrado* hoy = mismo root en cadena y en públicos, sin aún *probar* membresía en el circuito. *Paths* = siguiente circuito, con witness de Merkle y mismos roots en cadena vía el mismo mecanismo.

---

## 1. Estado del código hoy (importante)

| Elemento | Qué hace ahora |
|----------|-----------------|
| Circuito [`circuits/yohualli_one_attest_sig`](../circuits/yohualli_one_attest_sig/src/main.nr) | Solo prueba **ECDSA secp256k1** sobre un `message_hash` y una clave pública en coordenadas (`public_key_x`, `public_key_y`). **No** prueba Merkle, umbral de grafo ni `subjectCommitment` on-chain. |
| `evm/.../HonkVerifier.sol` | Verifica **esa** prueba; la longitud y el número de `bytes32` en calldata lo fija el compilador de Barretenberg para el VK actual. |
| Atestación v0 (EIP-712) | Incluye `subjectCommitment`, `epoch`, `schemaId`, etc.; la **misma** regla de `bytes32` debe reutilizarse al montar hojas y el circuito extendido. |

Hasta extender el circuito Noir, **Merkle + `merkleRootByEpoch[epoch]` viven en capa de producto/relé** o en un registro on-chain, pero **no** se validan criptográficamente dentro de la prueba desplegada. El siguiente corte de trabajo es **nuevo circuito** (Merkle + coherencia con el digest) → nueva VK → `bb write_solidity_verifier` → nuevo despliegue o contrato de actualización de verificador.

### 1.1 Dónde se generan las pruebas (Barretenberg)

| Dónde | Papel |
|-------|--------|
| **Máquina de desarrollo** (`nargo compile`, `bb prove`, scripts `npm run circuit:proof-hex:…`) | **Generación** de la prueba: costoso en CPU, artefacto `proof` + `public_inputs`. |
| **PWA / navegador (ZK Lab)** | Solo **verificación** on-chain: `eth_call` a `HonkVerifier` (o al gateway) con prueba y públicos **pegados o de muestras embebidas**. **No** ejecuta el prover de Barretenberg en el cliente. |

Un prover **WASM** en PWA sería fase distinta; no forma parte del estado actual del repo.

---

## 2. Criterio de Merkle (relay / batch) — a congelar

1. **Hoja lógica** = el mismo `subjectCommitment` (bytes32) que entra en `YohualliAttestationV0` y que fijarán los públicos del circuito cuando exista enlace en ZK. Sin divergencia entre relé, firma y prueba.
2. **Deduplicación** en un batch/epoch: si varios atestantes atestan al mismo sujeto, se conserva **una hoja** por `subjectCommitment` (mismo colaborador, distinto attester, no infla el set).
3. **Árbol** = sobre el conjunto de hojas del snapshot (más un hash/orden fijado en spec: orden lexicográfico de hoja, o árbol binario con padding explícito — **congelar** una regla y versionar con `schemaId` / struct si cambia).
4. **Trusted seeds** (o rol equivalente) son quienes **pueden actualizar** `merkleRoot` on-chain en el contrato de registro, por `epoch` o id de batch.

El **borrador 1.1** ya bocetea `MerkleRegistry` con `epoch`, `merkleRoot`, y consultas. Las firmas/roles concretas (`onlyTrustedSeed`, multisig) se fijan en el contrato real, no en este documento.

---

## 3. Registro on-chain: condición mínima del wrapper

Patrón recomendado (cuando el circuito ya **incluya** en públicos al menos un `merkle_root` y un `epoch` acordes):

1. `MerkleRegistry` (o equivalente) expone `getRoot(epoch) -> bytes32` fijado por los trusted seeds.
2. El **wrapper** (p. ej. `AttestationVerifyAndAnchor`) hace, en este orden lógico:
   - `require(merkleRootFromChain == public_merkle_root)`  
     donde `public_merkle_root` es uno de los `bytes32` de los **públicos** de la prueba (mismo `epoch` de política en digest si aplica), **o** un subconjunto fijado en el ABI.
   - `require(honkVerifier.verify(proof, publicInputs))`.

El `HonkVerifier` **no** hace el `getRoot`; la igualdad de roots es lógica de **negocio** en el wrapper. La **pertenencia al árbol** (path, índice, hoja) se prueba **dentro del circuito**; el nodo on-chain no recorre hojas.

### Públicos “objetivo” del borrador 1.1 (referencia, no aún en el main.nr actual)

El borrador lista como públicos de alto nivel, entre otros: `merkle_root`, `nullifier`, `threshold` (o bucket), y a veces entropía/VRF. Al implementar el circuito extendido hay que:

- Incluir campos y **orden** compatibles con Barretenberg/Noir.
- Volver a generar el Solidity y documentar en [`CIRCUITS_LAB.md`](./CIRCUITS_LAB.md) el encadenamiento con `npm run circuit:public-inputs:…`.

Hasta entonces, **no** asumir un orden fijo de `bytes32[]` en este archivo.

---

## 4. Falso amigo: “el verificador busca en el Merkle”

- **Falso:** el contrato generado `HonkVerifier` o el nodo EVM recorre el Merkle.  
- **Correcto:** el prover aporta una prueba; el circuito prueba (entre otras) **Merkle inclusion**; el contrato verifica un polinomio/gates y pública relación. El **almacenamiento** del `root` autorizado es comparación sencilla con el público o con `merkleRootByEpoch`.

---

## 5. Lista de comprobación para el siguiente corte

- [ ] **Noir:** nuevas entradas **públicas** y *witness* (path Merkle, etc.) y tests.
- [ ] Misma `message_hash` que el digest EIP-712 v0 congelado.
- [ ] `bb` + `sync` del verificador Solidity + pruebas Foundry.
- [x] Registro + gateway on-chain: contrato unificado `YohualliMerkleHonkRegistry.sol` (un `CREATE`; en Revive, dos `CREATE` en un mismo script a veces falla). Tienen módulos separados en el mismo paquete solo para `forge test`. `setMerkleRoot(epoch, root)`; `verifyForEpoch` cuando el circuito publique `merkle_root` en los públicos.
- [ ] Relé: algoritmo de árbol + deduplicación + (opcional) lectura de eventos on-chain o mirror del `merkleRoot`.
- [ ] **PWA:** wiring opcional a direcciones del `Gateway` / registry (hoy ZK Lab sigue apuntando solo al `HonkVerifier`).

## 6. Contratos en el repo (referencia rápida)

| Archivo | Rol |
|---------|-----|
| `evm/.../YohualliMerkleHonkRegistry.sol` | Despliegue: Merkle + `verify` / `verifyForEpoch` hacia el `HonkVerifier` (un solo address). |
| `evm/.../MerkleRootRegistry.sol` + `YohualliHonkGateway.sol` | Solo apoyo en tests; el script de despliegue usado en testnet es `DeployYohualliMerkleHonkRegistry.s.sol`. |
| `evm/.../script/DeployYohualliMerkleHonkRegistry.s.sol` | `HONK_VERIFIER_ADDRESS` + mismas credenciales que el deploy del verificador. |

---

## Documentos relacionados

- `docs/Yohualli Protocol draft 1.1.md` — sección V, `MerkleRegistry`, `NullifierStore`, bocetos.  
- `docs/YOHUALLI_EVM_CONTRACTS_ARCHITECTURE.md` — pago de gas, Merkle de sujetos.  
- `docs/CIRCUITS_LAB.md` — artefactos y scripts del repo.  
