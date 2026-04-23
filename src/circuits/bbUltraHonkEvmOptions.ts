/**
 * Opciones de prueba Honk alineadas con EVM (`bb prove -t evm`).
 *
 * **@aztec/bb.js 5.x:** `verifierTarget: 'evm'` fija oráculo keccak y `disableZk: false` (equiv. a `keccakZK` en 3.x).
 * No mezclar con `keccak` / `keccakZK` legacy a la vez (lo rechaza el binding).
 *
 * **3.x (obsoleto):** `keccak: true` forzaba `disableZk: true` y fallaba en WASM; `keccakZK: true` era el par correcto.
 *
 * La verificación on-chain exige un `HonkVerifier` / VK con la **misma** configuración
 * que la prueba (regenerar con `bb` si el contrato se creó con otro modo).
 */
export const ULTRA_HONK_EVM_PROOF_OPTIONS = { verifierTarget: 'evm' as const }
