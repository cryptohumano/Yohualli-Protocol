/**
 * Prueba y públicos de ejemplo del circuito `square` (x² = y, x=3, y=9).
 * Generados en `~/kusama-noir-lab/circuits/square` con nargo + bb.
 *
 * Se empaquetan con `?raw` desde `samples/` para que ZK Lab funcione aunque el
 * navegador use un proxy (p. ej. Simple Browser en `localhost:64926`), donde
 * `fetch` a `public/` devuelve ERR_EMPTY_RESPONSE. Copias en sync en
 * `public/zk-samples/` por si se desean servir por HTTP directo al servidor de desarrollo.
 */
import squareProofHex from './samples/square-proof.hex?raw'
import squarePublicInputs from './samples/square-public-inputs.txt?raw'

export const KUSAMA_NOIR_LAB_PATH = '~/kusama-noir-lab'

export async function loadSquareSampleFromPublic(): Promise<{
  proofHex: string
  publicInputsText: string
}> {
  return {
    proofHex: squareProofHex.trim(),
    publicInputsText: squarePublicInputs.trim(),
  }
}
