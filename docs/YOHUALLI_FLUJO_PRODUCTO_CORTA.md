# Flujo de producto — **v1 corta** (sin ZK de peso ni path Merkle en circuito)

Este documento fija la **corta** acordada con el producto: **grafo y score se calculan off-chain en la PWA; la cadena solo ancla *snapshots* (raíz Merkle por epoch) y verifica atestaciones ZK del tipo *merkle v1* (ECDSA + `merkle_root` público)**, coherente con [YOHUALLI_MERKLE_PROOF_V0.md](YOHUALLI_MERKLE_PROOF_V0.md).

**No** forma parte de la corta: prueba de **path** bajo el árbol, **nullifiers**, ni **weight** del grafo *dentro* de un circuito. Eso se trata en [YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md](YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md) o en una futura *spec* de *Sybil* on-chain.

---

## 1. Papel de cada capa

| Capa | Responsabilidad en la v1 corta |
|------|---------------------------------|
| **Atestación (EIP-712, off-chain / relay)** | Sujetos (SS58) anclados a `subjectCommitment` v0; firmas del atestador (EVM) según [YOHUALLI_ATTESTATION_SIGNING_V0.md](YOHUALLI_ATTESTATION_SIGNING_V0.md). El grafo social **crece** con cada atestación almacenada. |
| **Cálculo de “peso / score”** | **Solo** en la PWA o servicios: Tier-Sybil, *trusted seeds* de lab, políticas de ingest. Ver *sybil* en [yohualli-tier-sybilrank-matematica.md](yohualli-tier-sybilrank-matematica.md) y [trustedSeedsLab](../src/social-graph/trustedSeedsLab.ts) (código). **No** hay *weight* fijado en un contrato ZK. |
| **Merkle / epoch on-chain** | `YohualliMerkleHonkRegistry`: un **operador** (o multisig) publica `merkleRoot[epoch]`. Las **hojas** del *snapshot* se deducen off-chain a partir de criterio de producto (p. ej. solo *subjectCommitment* de sujetos **alcanzados** por *trusted* en un batch acordado). Cálculo: `npm run merkle:root:trusted-seed-leaves` o tu propia lista + misma fórmula v0. |
| **Prueba ZK (circuito *merkle v1*)** | Demuestra **ECDSA** respecto a un `message_hash` y fija en público un `merkle_root` **igual** a la raíz fijada para ese *epoch* (`verifyForEpoch` con el índice de p. ej. 128 públicos, `merkleFieldStart=96` para v1 en la PWA). **No** demuestra *membresía* de hoja en el árbol. |

---

## 2. Flujo operativo mínimo (narrativa)

1. **Ceremonias / uso:** los *seeds* se atestan unos a otros; el grafo local y el *score* (Sybil) evolucionan con las reglas que tengáis.  
2. **Batch “con peso gubernamental” (política):** determináis qué `subjectCommitment` entran al árbol del *snapshot* (p. ej. solo hojas que vuestro análisis marca como validadas vía *trusted*).  
3. **Publicación on-chain:** `setMerkleRoot(epoch, root)` en el *registry* fijado.  
4. **Verificación en chain / lab:** *prove* *merkle* v1 con el mismo *root* y `eth_call` a *verify* o `verifyForEpoch` con [env y Honk alineado](../evm/yohualli_honk_verifier/README.md) ([ZK Lab en la PWA: `/zk-lab`](../src/router/index.tsx)).

**Umbral de producto (sin ZK de peso):** podéis **comparar** *score* off-chain con un umbral **en la app**; la cadena, en la corta, **solo** asegura coherencia **merkle** + (si usáis la prueba) **autenticación** cripto del *digest*, no *“pesa al menos T”* como restricción en *Solidity* salvo que *programéis* esa lógica aparte a partir de datos *no* de una sola prueba *merkle* v1 clásica.

---

## 3. Comandos / artefactos ya alineados en el repo

| Necesidad | Referencia |
|-----------|------------|
| Raíz desde semillas *trusted* (1 hoja = un `subjectCommitment` v0) | `npm run merkle:root:trusted-seed-leaves` |
| *Prover.toml* para *merkle* v1 con el mismo criterio de *root* por defecto | `npm run merkle:prover-toml:merkle-v1` (ver [gen-yohualli-merkle-attest-v1-prover.mjs](../scripts/gen-yohualli-merkle-attest-v1-prover.mjs)) |
| *Registry* fijo, `setMerkleRoot` | [evm/yohualli_honk_verifier/README.md](../evm/yohualli_honk_verifier/README.md) y [scripts/forge-merkle-set-root.sh](../scripts/forge-merkle-set-root.sh) |
| Constante de *lab* `merkle` = hoja *trusted* | [labTrustedSeedMerkleRootV0.ts](../src/circuits/labTrustedSeedMerkleRootV0.ts) |

---

## 4. Cierre: qué sigue fuera de la **corta**

- **Corta** = crecer grafo + *score* local + *snapshot* *Merkle* *on-chain* *por epoch* *+* *merkle* v1 para quien tenga *HK* o demos.  
- **Larga** = *membership* Merkle en *ZK*, *weight* o agregado **probado** en *circuito*, o *policies* y *nullifiers* — ver el borrador v2 y *whitepaper* actualizado cuando lo congeléis.

Cualquier cambio de criterio de hoja, de *H* o de orden del árbol requiere **misma** regla en *relé, script de root y* (futuro) *Noir*.

**Flujos de pantalla y actores (Atestations vs ZK Lab):** [YOHUALLI_FLOJOS_UX_ACTORES.md](YOHUALLI_FLOJOS_UX_ACTORES.md).
