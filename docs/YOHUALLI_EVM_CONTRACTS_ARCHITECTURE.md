# Yohualli: decisiones de arquitectura para contratos inteligentes y circuitos

Este documento **congela decisiones de diseño** acordadas para el trabajo con **EVM**, **circuitos Noir** y **contratos**. Complementa `docs/Yohualli Protocol draft 1.1.md` y `docs/YOHUALLI_ACERCAMIENTO_WHITEPAPER.md` en aspectos operativos que suelen repetirse al implementar `verify`, Merkle, nullifiers y flujos de usuario.

---

## 1. Identificadores Substrate vs criptografía en cadena

| Capa | Decisión |
|------|----------|
| **Identidad / índice en grafo, gossip, relayers** | Pueden usarse **identificadores Substrate** (p. ej. dirección SS58) como **etiquetas estables** y opacas en mensajes off-chain. |
| **Firmas y circuitos que verifica el contrato** | **Prioridad EVM:** **ECDSA `secp256k1`**. El payload de atestación v0 está definido en **[`YOHUALLI_ATTESTATION_SIGNING_V0.md`](./YOHUALLI_ATTESTATION_SIGNING_V0.md)** (EIP-712: dominio + struct `YohualliAttestationV0`). |
| **SR25519** | **No** es el algoritmo de firma objetivo para pruebas que deba verificar el verificador on-chain; como mucho aparece en capas legacy o solo como **identificador** hasta migrar flujos. |

Los contratos y el verificador **no derivan** claves: solo ven **prueba, entradas públicas y, si aplica, `msg.sender`**. La coherencia con esta tabla es responsabilidad del **diseño del circuito** y del **payload firmado**.

---

## 2. Derivación HD: nombres lógicos y paths BIP44 canónicos

- Los nombres tipo “`/yohualli/attest`” o “rol nullifier” son **útiles en documentación y UI** como *roles criptográficos* (separación de claves desde la misma mnemónica).
- En **EVM**, la representación **normativa** debe ser un **path BIP32/BIP44** reconocible por carteras y hardware (`m/44'/60'/…`).

### Ejemplo ilustrativo (números a sustituir al congelar el spec)

Se asume una **cuenta reservada** `10'` solo para material Yohualli bajo `coin_type' = 60'`:

| Rol lógico | Path BIP44 (ejemplo) | Uso |
|------------|----------------------|-----|
| Atestación (firma de payload verificable en circuito) | `m/44'/60'/10'/0/0` | Clave pública que entra en gadgets ECDSA en Noir / en el digest acordado. |
| Nullifier u otro secreto de protocolo | `m/44'/60'/10'/0/1` | Material derivado distinto; no reutilizar la clave de atestación salvo diseño explícito. |

**Acción pendiente:** reemplazar `10'` y los índices finales por valores **oficiales** en una tabla única (versión `v1`) antes de desplegar contratos que asuman derivación en cliente.

### 2.1. Tabla de identidades (lab) — no mezclar filas

Una **misma** entidad humana o seed puede proyectarse en **varias** direcciones. Referencia congelada con el listado de [`src/social-graph/trustedSeedsLab.ts`](../src/social-graph/trustedSeedsLab.ts) y con la variable de entorno de la PWA `VITE_PASEO_VERIFIER_ADDRESS` (dirección del **contrato** `HonkVerifier`, no de una EOA).

| Rol en producto / doc | Path o artefacto | Notas |
|------------------------|------------------|--------|
| Nodo en grafo / gossip (substrate) | — | SS58 fijo en lab: `5FnBJLXEjEYiGeTgKaxapS2m8WpsTUGp1sj2ZbwMhodQUo9t` (ver `LAB_TRUSTED_SEED_IDENTITIES`). |
| EVM “cara pública” / listada como trusted (lab) | `m/44'/60'/0'/0/0` | `0x99B65AE259Fc06fF4A90cE898eaA1BD2aaF32eb8` — [`trustedSeedsLab`](../src/social-graph/trustedSeedsLab.ts) (`evm`); fondeo / deploy, **no** clave de digest EIP-712 ni pares `(pkx,pky)` del prover. |
| EVM firmante **EIP-712** y pública en circuito ECDSA (misma entidad) | `m/44'/60'/10'/0/0` | `0xA4a6B032591CF6805808d838a5ab1a44463Ea16` (ver `YOHUALLI_ATTESTATION_BIP44_PATH` y `LAB_YOHUALLI_EVM_ATTEST_10` en el mismo módulo). Otra dirección que la de fondos. Regenerar con `npm run lab:derive-evm-roles` si rotás la frase. |
| Contrato `HonkVerifier` (testnet) | bytecode desplegado | Debe **coincidir** con la VK del circuito (v0 = 96 públicos, v1 Merkle = 128). Ej. v0: `0xcc6d688c8969F4870557f23f4515e0E7D60383F4`; v1 `yohualli_merkle_attest_v1` (lab): `0x9D098225B1C375F95576047C6D6F0252126CaFE6`. Variable PWA: `VITE_PASEO_VERIFIER_ADDRESS`. **No** es un attester. |
| EOA que paga el deploy o el gas on-chain | — | P. ej. la **misma** `0x99B6…` que mueve fondos; el verificador **no** vincula la prueba a `msg.sender` del deploy, solo a prueba + públicos. |
| Sujeto atestado (v0) | Identidad en grafo + `subjectCommitment` | Sigue siendo eje **SS58** (y commitment del doc v0); el “lado atestado” no exige en v0 un segundo 0x paralelo. |

**Regla práctica:** si en Merkle, circuito o trusted list se necesita el **ECDSA de atestación**, usar la EVM de **`m/44'/60'/10'/0/0`**, no la de fondos, salvo documentación explícita en contra.

---

## 3. Pago de gas (`msg.sender`) vs identidad demostrada en la prueba

**Decisión:** la **EOA que firma la transacción** (p. ej. cuenta de fondos en un path habitual `m/44'/60'/0'/0/0`) **no tiene por qué** ser la misma que la clave asociada al **peso en el grafo** o al **leaf** del Merkle (derivada en otro path, p. ej. `m/44'/60'/10'/0/0`).

| Correcto | Incorrecto (salvo spec explícito) |
|----------|-------------------------------------|
| El contrato valida **prueba + públicos** (`merkle_root`, nullifier, bucket de umbral, etc.). Cualquier `msg.sender` puede enviar la transacción o pagar gas (EOA, paymaster, meta-tx). | Exigir `msg.sender ==` la dirección del “rol grafo” **sin** un enlace criptográfico documentado entre ambas claves. |

Si un producto requiere **atribución on-chain** del mismo actor que paga y el que prueba pertenencia al Merkle, debe especificarse un **mecanismo explícito** (enlace en circuito, delegación firmada, cuenta única, etc.); no es el comportamiento por defecto recomendado.

---

## 4. Atestación base por epoch y Merkle

- La **inclusión en el `merkle_root`** de una epoch puede modelarse como la **atestación base** on-chain para esa ventana de tiempo.
- Las **pruebas ZK** demuestran **pertenencia / política** (p. ej. umbral de peso como *property check*) respecto a ese root y a reglas de nullifier, **sin** reconstruir el grafo en el contrato (alineado con el borrador 1.1).

Los **identificadores SS58** u otros ids en relayers siguen siendo **transporte / índice**; la **verificación criptográfica** ante el contrato sigue el apartado 1.

---

## 5. Relayers y compromisos

- Los relayers pueden operar solo con **identificadores opacos** y payloads acordados.
- La **consistencia** entre id de grafo y lo que acepta el circuito debe lograrse con **compromisos y firmas ECDSA** sobre un payload congelado (hashes de sujeto/contexto/epoch, etc.), no asumiendo que “el id visible” sustituye a la prueba.

---

## 6. Nota de contexto (Kilt)

En ecosistemas tipo **Kilt**, la pallet de atestaciones puede **anclar una clave pública DID** para atribuir atestaciones verificables. En Yohualli el paralelo conceptual es **política verificable** (grafo, peso, umbral) materializada en **prueba + root + nullifier**; la **atribución fuerte** a la identidad EVM del protocolo viene de la **derivación y del circuito**, no de mezclar sin criterio el pagador de gas con el leaf del Merkle.

---

## 7. Lista de comprobación para autores de contratos

- [ ] `verify` y la lógica de negocio dependen de **públicos** y de la **prueba**, no de suposiciones implícitas sobre qué wallet pagó gas.
- [ ] Los **paths BIP44** usados en cliente están **tabulados y versionados** (p. ej. sección 2.1) en documentación junto a este archivo.
- [ ] El **payload** firmado con ECDSA y el **circuito** usan el mismo esquema de hashing / dominio documentado.
- [ ] Quedó claro si existe **excepción** donde `msg.sender` debe igualar a una clave de protocolo (y por qué).

---

## 8. Merkle, registro de `merkleRoot` y wrapper (spec v0)

El boceto de `MerkleRegistry` y `VerifierWrapper` en el borrador 1.1 es la referencia de producto. En el repositorio, el circuito `yohualli_one_attest_sig` **aún** solo prueba ECDSA; la inclusión Merkle y la igualdad `merkleRootByEpoch[epoch] == public_merkle_root` corresponden al **siguiente** circuito + contratos.  
**Especificación operativa y lista de comprobación:** [`YOHUALLI_MERKLE_PROOF_V0.md`](./YOHUALLI_MERKLE_PROOF_V0.md) (criterio de hoja = `subjectCommitment`, deduplicación, condición en wrapper, qué hace hoy el `HonkVerifier` frente a lo que probará el circuito extendido).

---

## Documentos relacionados

- `docs/Yohualli Protocol draft 1.1.md` — borrador normativo general.  
- `docs/YOHUALLI_ACERCAMIENTO_WHITEPAPER.md` — orden de trabajo por fases.  
- `docs/YOHUALLI_ATTESTATION_SIGNING_V0.md` — **EIP-712: dominio y struct v0** (digest de firma).  
- `docs/YOHUALLI_MERKLE_PROOF_V0.md` — **Merkle + prueba: estado del código y patrón de registro/wrapper**.  
- `docs/CIRCUITS_LAB.md` — estado del código TypeScript y muestras en el repo.  
- `docs/yohualli-tier-sybilrank-matematica.md` — ranking local de laboratorio (no sustituye el circuito ZK completo).
