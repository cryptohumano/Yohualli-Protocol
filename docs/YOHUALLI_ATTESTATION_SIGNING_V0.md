# Contexto de firma v0 — atestación Yohualli (EIP-712)
Este documento define el **dominio** y el **mensaje primario** que la wallet debe firmar con **ECDSA `secp256k1`** (`eth_signTypedData_v4`). Es la referencia para:
- implementación en cliente (`viem` / `ethers`);
- replicación del digest en **Noir** (gadget ECDSA sobre el mismo hash);
- contratos que validen firmas off-chain o que fijen `verifyingContract`.
**Versión del esquema:** `v0` (este archivo). Cualquier cambio de tipos, nombres o orden de campos implica **nueva versión** (`v1`, …) y nuevo `EIP712Domain.version`.
---
## 1. Resumen EIP-712
El digest firmado es:
\[
\text{digest} = \texttt{keccak256}\bigl( \texttt{0x1901} \,\|\, \texttt{domainSeparator} \,\|\, \texttt{hashStruct}(\texttt{YohualliAttestationV0}) \bigr)
\]
- `domainSeparator = hashStruct(EIP712Domain)` según el estándar.
- `hashStruct(YohualliAttestationV0)` usa el **orden de campos** definido abajo (inalterable sin bump de versión).
Referencia normativa: [EIP-712](https://eips.ethereum.org/EIPS/eip-712).
---
## 2. `EIP712Domain`
| Campo (Solidity) | Tipo | Valor v0 | Notas |
|------------------|------|----------|--------|
| `name` | `string` | `"Yohualli"` | Identificador humano del protocolo. |
| `version` | `string` | `"1"` | Junto con tipos/campos, versiona el mensaje. Subir a `"2"` si cambia el struct. |
| `chainId` | `uint256` | **ID de la red EVM** donde aplica la política | Debe coincidir con la cadena donde se verifica (p. ej. Polkadot Hub Testnet: usar el mismo `chainId` que en MetaMask; en el código de la PWA suele venir de `VITE_PASEO_CHAIN_ID` / `paseoPassetHub.id`). |
| `verifyingContract` | `address` | Ver abajo | Ancla el mensaje a un contrato concreto o modo lab. |
### `verifyingContract` en v0
| Modo | Dirección | Uso |
|------|-----------|-----|
| **Laboratorio / mensaje aún sin despliegue** | `address(0)` (`0x0000…0000`) | Firma válida para prototipos y tests; **no** usar en mainnet sin revisión: cualquier contrato podría reinterpretar el mensaje si no se sustituye por un ancla real. |
| **Producción** | Contrato **registro / verificador de atestaciones** desplegado | Recomendado cuando exista el contrato: el usuario ve en la wallet a qué contrato “ató” la firma. |
**Decisión v0:** se permite `0x0…0` en entornos de prueba; la transición a un `verifyingContract` fijo debe documentarse y subir `version` o el nombre del tipo si el contrato exige otro esquema.
`EIP712Domain` **sin** `salt` en v0. Si en el futuro se necesita un namespace adicional sin contrato, se puede añadir `bytes32 salt` en una versión nueva del domain (EIP-712 lo admite).
---

## 3. Tipo primario: `YohualliAttestationV0`
Orden de campos **obligatorio** (así se define `encodeType` y `hashStruct`):
| Campo | Tipo Solidity | Significado |
|-------|----------------|-------------|
| `contextId` | `string` | Ámbito lógico (p. ej. `"yohualli-lab"`, `"governance-v1"`). Evita que la misma firma se reutilice en otro producto. |
| `epoch` | `uint64` | Ventana temporal acordada (altura de bloque, índice de ronda off-chain, o contador de epoch de protocolo). Debe definirse en el spec de capa relayer / registro. |
| `subjectCommitment` | `bytes32` | Compromiso del sujeto atestado (p. ej. `keccak256(abi.encodePacked("substrate:ss58", rawSs58Bytes))` o esquema explícito en un doc de “compromisos de identidad”). **No** incluir el SS58 en claro en el struct si se busca minimizar fuga en wallets y exploradores. |
| `thresholdBucket` | `uint8` | Bucket de umbral de confianza (property check, no el score continuo). Rango permitido debe fijarse off-chain (p. ej. 0–255 con tabla de significado). |
| `schemaId` | `bytes32` | Ancla canónica del **contenido semántico** del resto de campos (p. ej. `keccak256("YohualliAttestationV0/1")` o hash de un JSON de schema). Permite evolucionar significados sin reutilizar firmas antiguas. |
**No** se incluye la dirección del firmante en el struct: se obtiene por **recuperación ECDSA** del `digest` (o se añade en una variante `v1` si un producto lo exige explícitamente).
**Anti-replay adicional:** `epoch` + `domainSeparator` (`chainId` + `verifyingContract`) suelen bastar; si hace falta un contador por atestador, valorar un campo `uint64 nonce` en `v1`.
---

## 4. Definición de tipos (para carteras y código)
Orden de tipos para `eth_signTypedData_v4` (referencia):
```text
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
YohualliAttestationV0(string contextId,uint64 epoch,bytes32 subjectCommitment,uint8 thresholdBucket,bytes32 schemaId)
```
El `schemaId` v0 sugerido (sólo convención, congelar en implementación):
- `keccak256("YohualliAttestationV0.string+uint64+bytes32+uint8/1")`  
  o un `bytes32` fijo documentado en código una vez generado.
---

## 5. Compromiso del sujeto (`subjectCommitment`)
**v0 (recomendado):** separar “identificador en grafo” de “secreto en compromiso”:
- Entrada: bytes del SS58 decodificados o string UTF-8 normalizado + prefijo de dominio.
- Ejemplo de especificación a congelar en código:
  `subjectCommitment = keccak256(abi.encodePacked(uint8 kind, bytes subjectBytes))` con `kind = 1` para SS58.
Cualquier cambio de fórmula ⇒ nuevo `schemaId` o nueva versión del struct.
---
## 6. Implementación
| Componente | Responsabilidad |
|------------|-----------------|
| PWA / script | Construir `domain`, mensaje y llamar `signTypedData`. |
| Contrato (opcional) | `ecrecover` o validación off-chain del digest; en flujo ZK, el circuito demuestra coherencia con el mismo digest. |
| Noir | Verificar ECDSA sobre el digest de 32 bytes igual al de EIP-712 (mismo `chainId`, `verifyingContract` y campos). |
---
## 7. Documentos relacionados
- `docs/YOHUALLI_EVM_CONTRACTS_ARCHITECTURE.md` — `msg.sender` vs prueba, BIP44.  
- `docs/Yohualli Protocol draft 1.1.md` — borrador completo.  
- `docs/YOHUALLI_ACERCAMIENTO_WHITEPAPER.md` — fases de implementación.