# Siguiente circuito: inclusión Merkle (borrador v2)

**Estado:** especificación de trabajo; **no** implementado aún en el repo. El circuito desplegado hoy es `yohualli_merkle_attest_v1` (ECDSA + `merkle_root` **público** sin probar el árbol).

**Objetivo cripto:** además de verificar la firma sobre el digest acordado, probar en constraints que una **hoja** pertenece a un **árbol Merkle** cuyo **root** coincide con el `merkle_root` on-chain (vía `verifyForEpoch` con el mismo empaquetado de 32 `Fr`).

**Referencia on-chain / producto:** [`YOHUALLI_MERKLE_PROOF_V0.md`](./YOHUALLI_MERKLE_PROOF_V0.md) §2 (criterio de hoja, deduplicación, orden) y `YohualliMerkleHonkRegistry.sol`.

---

## 1. Qué añade respecto a v1

| v1 (`yohualli_merkle_attest_v1`) | v2 (inclusión) |
|----------------------------------|----------------|
| `merkle_root` en públicos; aserción trivial (binding al transcript) | Añade *witness* de path y **rehash** hasta comprobar `root` |
| El relé “debería” construir un árbol cuyo root pone on-chain; el prover no prueba coherencia hoja–árbol | El prover **prueba** `leaf` + `siblings` + `pathBits` → `merkle_root` (regla de árbol congelada) |

El contrato **sigue** sin recorrer Merkle: solo `merkleRoot[epoch] == f(publicInputs)` y `honk.verify`.

---

## 2. Entradas (borrador; nombres a ajustar con Noir)

### Públicas (o deducibles del digest / política)

- `message_hash: [u8; 32]` — alineado con [YOHUALLI_ATTESTATION_SIGNING_V0](YOHUALLI_ATTESTATION_SIGNING_V0.md) (mismo que v0/v1).
- `public_key_x`, `public_key_y` — EOA de atestación (p. ej. `m/44'/60'/10'/0/0`).
- `merkle_root: [u8; 32]` — root canónico (mismo empaquetado a `Fr` que v1 para `merkleFieldStart` en Solidity).
- **Una o más** de (decisión de diseño):
  - `leaf: [u8; 32]` pública, **o**
  - el circuito recibe `leaf` como witness y una **restricción** la liga a `message_hash` / `subjectCommitment` (p. ej. `leaf = keccak(subjectCommitment, …)` con regla fijada en spec §2).

### Privadas (witness)

- `signature: [u8; 64]`.
- **Merkle:** hoja; vector de `sibling` por nivel; bits de izquierda/derecha (o índice de hoja y función de compaginación fija).  
- **Profundidad fija** `D` (p. ej. 32) con **padding** explícito de hojas vacías documentado, o `D` paramétrica con coste de circuito distinto (decisión abierta).

### Aserciones lógicas

1. `verify_signature` (igual que v1) sobre `message_hash` y clave pública.
2. **Merkle:** para `i = 0 .. D-1`, combinar `current` con `sibling[i]` según `path[i]` con la **misma** función de hash **H** que use el relé off-chain.
3. El resultado final `== merkle_root` (comparación byte a byte o campo finito según encaje con `u8[32]`).

---

## 3. Decisiones a congelar **antes** de programar

1. **H** en cada nivel: `keccak256(concat(a,b))` (barato en EVM, caro en ZK) vs **Poseidon** u otro hash amigable (común en ZK; **debe** ser el mismo que en el off-chain que construye el árbol).
2. **Orden** de argumentos en el hash (izq/der) y convención de hoja: ¿`H(subjectCommitment)`? ¿`H` de la transcripción EIP-712? Debe ser **idéntica** a §2 de `YOHUALLI_MERKLE_PROOF_V0.md`.
3. **Profundidad** `D` y manejo de árbol no lleno.
4. **Público vs privado** del `leaf` (revelar hoja on-chain o solo root + prueba de inclusión con ligadura a digest en constraints).

---

## 4. Cadena de ingeniería tras congelar el `main.nr`

1. `nargo compile` + `bb prove` + tests de integridad con casos de test (árbol mínimo 1–2 hojas).
2. `bb write_solidity_verifier` → `sync` al paquete Foundry.
3. Nuevo `merkleFieldStart` si el **orden** o **número** de públicos cambia (actualizar comentario en `YohualliMerkleHonkRegistry` y `YOHUALLI_MERKLE_ATTEST_V1_MERKLE_FR_START` equivalente en TypeScript, con nombre v2).
4. Despliegue de un **nuevo** `HonkVerifier` y `setHonkVerifier` en el **registry fijo** (o nuevo registry, si se prefiere no mezclar VK).
5. `CIRCUITS_LAB.md` + scripts `npm run circuit:…:v2` + muestras embebidas PWA.

---

## 5. Relación con v1

- v1 sigue siendo **válido** para demos de “anclaje de root + ECDSA” sin inclusión.
- v2 **sustituye** el rol de prueba de membresía que hoy asume el relé “de buena fe”.

---

## Documentos relacionados

- [`YOHUALLI_MERKLE_PROOF_V0.md`](./YOHUALLI_MERKLE_PROOF_V0.md) — §0 (registry fijo, loop, paths).  
- [`CIRCUITS_LAB.md`](./CIRCUITS_LAB.md) — flujo `bb` / PWA.  
- [`YOHUALLI_ATTESTATION_SIGNING_V0.md`](./YOHUALLI_ATTESTATION_SIGNING_V0.md) — digest v0.
