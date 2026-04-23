# Acercamiento a la versión de whitepaper (entorno de prueba)

Este documento describe un orden de trabajo **realista** para acercar la implementación al diseño de Yohualli, sin pretender cerrar todo en un solo paso. El objetivo es una **versión de prueba** verificable (código + circuitos + contrato mínimo) antes de invertir en relayers completos o en optimizaciones de privacidad avanzadas.

**Documento normativo en el repositorio:** `docs/Yohualli Protocol draft 1.1.md` (borrador 1.1). Las fases de abajo deben leerse **siempre** junto con ese archivo.

**Decisiones para EVM / contratos / derivación:** [`YOHUALLI_EVM_CONTRACTS_ARCHITECTURE.md`](./YOHUALLI_EVM_CONTRACTS_ARCHITECTURE.md) (identificadores vs ECDSA, paths BIP44, `msg.sender` vs prueba).

**Payload de firma v0 (EIP-712):** [`YOHUALLI_ATTESTATION_SIGNING_V0.md`](./YOHUALLI_ATTESTATION_SIGNING_V0.md) — dominio, struct `YohualliAttestationV0` y `subjectCommitment`.

## Qué aclara el borrador 1.1 (respecto a dudas de arquitectura)

1. **Curva unificada `secp256k1`:** Identidad local, firmas de atestación, compromisos ZK y verificación on-chain se alinean con el estándar EVM/Noir (secciones II.1, III.2 y nota criptográfica). Se evita la conversión de curva entre grafo y circuito; Noir puede usar gadgets nativos y se reduce el coste en constraints.
2. **Semilla BIP39:** Derivación determinista hacia un par `secp256k1` por path HD acordado (III.2).
3. **Master secret:** Derivado en la PWA, nunca expuesto; base de compromisos por aplicación y nullifiers (III.2, III.3, V.1).
4. **Nullifier:** Formulación ZK-nativa con `Poseidon2` y dominios (`master_secret`, `app_id`, semilla VRF / entropía de bloque según el apartado correspondiente) (V.1, V.2).
5. **Trust Score:** Se calcula off-chain; el circuito demuestra **propiedades** (por ejemplo *TS*(*u*) ≥ *threshold*), no el valor exacto del score (IV.1.1, nota ZK).
6. **Contrato:** Valida prueba, `MerkleRoot`, nullifier y política anti–doble gasto; no reconstruye el grafo (II.3, III.3).

**Brecha con el código actual:** el grafo y las atestaciones en la PWA siguen firmadas con **SR25519** (keyring Substrate). El borrador 1.1 asume **secp256k1** para atestaciones. La migración de prueba consiste en alinear implementación y borrador (nuevo codec de firma, paths HD y almacenamiento) o documentar una excepción explícita si se mantiene SR25519 solo como capa legado.

## Principio rector

El borrador mezcla varias capas: identidad en cliente (`secp256k1`, Noir/WASM), grafo social off-chain, asentamiento on-chain (raíces Merkle, nullifiers, contratos) y red P2P. **No conviene** implementar todo en paralelo. Lo que más reduce riesgo es **fijar primero** la derivación (semilla → master secret → entradas públicas/privadas del circuito) y **después** los circuitos incrementales y el contrato mínimo.

## Fase 0 — Especificación escrita (corta, obligatoria)

Antes de escribir más circuitos:

1. **Secreto maestro y derivación (alineado al borrador 1.1)**  
   Congelar en una tabla: path HD `secp256k1`, derivación del `master_secret`, dominios para `Poseidon2` (nullifier y compromisos por app), y cómo se relacionan con el `merkle_root` on-chain. Si se mantiene SR25519 en cuentas Substrate legacy, documentar el puente o el plan de sustitución.

2. **Qué prueba exactamente el primer circuito útil**  
   Debe coincidir con V.1–V.2 del borrador: nullifier, pertenencia Merkle, verificación de firmas `secp256k1` en gadgets Noir, y (más adelante) la *property check* del umbral de confianza.

Entregable: un solo documento o sección en el repositorio que el equipo pueda revisar sin abrir Noir.

## Fase 1 — Master secret y derivación `secp256k1` en la PWA

Objetivo: **código ejecutable** que implemente lo descrito en III.2 y III.3 del borrador: par `secp256k1` desde BIP39, `master_secret` que no salga del dispositivo, y derivación de compromisos/nullifiers por contexto.

- Derivación HD y almacenamiento seguro (IndexedDB), coherente con la PWA soberana.
- Pruebas unitarias de determinismo y de etiquetas de dominio (por aplicación / epoch).

Esto **no** sustituye el circuito; prepara las entradas privadas que Noir debe verificar.

## Fase 2 — Circuitos Noir por capas (prioridad alta)

Sí: **los circuitos son el núcleo técnico del whitepaper** en lo que respecta a verificación matemática on-chain. Conviene subir por **complejidad incremental**:

| Orden | Circuito (ejemplo) | Rol respecto al whitepaper |
|------|----------------------|----------------------------|
| 1 | Nullifier / compromiso simple | Demuestra conocimiento de secreto y evita doble uso (base del apartado de unicidad). |
| 2 | Pertenencia a Merkle + nullifier | Acerca el modelo “raíz on-chain + prueba sin revelar hojas”. |
| 3 | Umbral de confianza (propiedad, no score exacto) | Alineado con “property check” en lugar de SybilRank completo dentro del circuito. |
| 4 | Verificación de firma `secp256k1` en circuito | En el borrador 1.1 es el camino **nativo** (III.2, V.2), no opcional a largo plazo. |

### Qué significa «primero firma / Merkle / nullifier / umbral sobre estado ya construido off-chain»

No es que el **orden de implementación** de la tabla de arriba sea rígido (por ejemplo, un circuito mínimo **solo ECDSA** sobre el digest EIP-712 puede adelantarse por pedagogía). La idea es otra:

1. **El grafo social** (quién atestó a quién, pesos, vecindario, trusted seeds, etc.) se **materializa en cliente** (IndexedDB, gossip, reglas de ingestión). Eso produce **hojas**, **compromisos** y la **política** que decide qué entra en el Merkle de una epoch.
2. **El circuito no “reconstruye” el grafo entero.** Los constraints explotarían y no es el modelo del borrador (el circuito verifica **propiedades** y **consistencia** con un `merkle_root` y nullifiers, no recalcula SybilRank completo).
3. **Lo primero que tiene sentido en producto** es encadenar: **firma** (atestación vinculada al payload acordado, véase `YOHUALLI_ATTESTATION_SIGNING_V0.md`) → **inclusión en Merkle** (estado publicado o preparado para publicación) → **nullifier** (anti–doble uso) → **umbral** (bucket / property check). Todo sobre **datos ya derivados** del grafo off-chain, no al revés.

Si se intentara el grafo completo *dentro* del primer `main.nr`, se mezclarían depuración de red, ingestión y ZK a la vez.

Cada circuito debe tener: `nargo` + prueba local + `bb` + verificador Solidity desplegado (como ya hacéis en el laboratorio ZK), y **prueba de ejemplo** en `public/zk-samples/` o equivalente para pruebas manuales.

## Fase 3 — Grafo y “Trust Score” alineados al documento (off-chain primero)

El whitepaper define fórmulas de confianza y detección de islas Sybil. En código:

1. Implementar el **cálculo de TS (u)** (o una variante acotada) **solo en cliente**, sobre el subgrafo que ya almacenáis.
2. Comparar resultados con casos de prueba pequeños (grafos de juguete) para validar la fórmula.
3. Decidir qué entra al circuito en la fase actual: casi siempre un **booleano o rango** (“cumple umbral”), no el valor real del score.

Con el borrador 1.1, las aristas del grafo se entienden como **atestaciones firmadas en `secp256k1`**; el circuito valida esas firmas con gadgets Noir y el estado Merkle/nullifier on-chain (IV.4, V). Hasta migrar el código desde SR25519, el TS off-chain puede seguir calculándose sobre el modelo actual, pero la prueba on-chain debe seguir el borrador.

## Fase 4 — Asentamiento on-chain (contrato)

- Contrato que reciba **prueba + entradas públicas** (como el HonkVerifier) y, si procede, escriba **nullifier** o estado mínimo.
- Flujo desde la PWA: `eth_call` para depuración; luego transacción real con gas en la red de prueba.

Esto acerca el “árbitro verificador” del whitepaper sin exigir el grafo completo en cadena.

## Fase 5 — Relayers y Gossip (cuando el núcleo criptográfico cierre)

Ya tenéis una base de gossip local. Ampliar relayers, salts y WebRTC encaja aquí, **después** de que nullifier + Merkle + contrato mínimo sean estables; si no, se depura red y criptografía a la vez.

## Resumen: ¿por dónde empezar?

1. **Especificación de derivación y nullifier (Fase 0).**  
2. **Implementación de master key / derivación ZK en la PWA (Fase 1).**  
3. **Circuitos incrementales (Fase 2)** — sí, es lo que más acerca el test al whitepaper en términos de **prueba verificable**.  
4. **TS y grafo** alineados al texto, calculados off-chain y acotados para el circuito (Fase 3).  
5. **Contrato y estado** (Fase 4), luego **relayers** (Fase 5).

## Nota sobre idioma del proyecto

Las nuevas interfaces de usuario y documentación orientadas a este protocolo deberían redactarse en **español neutro**, salvo términos técnicos habituales en inglés (nullifier, Merkle root, circuit, prover).
