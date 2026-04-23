/**
 * Prueba y públicos de ejemplo para `circuits/yohualli_one_attest_sig` (misma corrida de `bb prove`).
 * Deben coincidir con el `HonkVerifier` generado y desplegado para ese circuito.
 *
 * Regenerar (desde la raíz del repo) si cambiás el circuito o el witness y volvés a probar:
 *   npm run circuit:proof-hex:yohualli1 > src/circuits/samples/yohualli-one-attest-proof.hex
 *   npm run circuit:public-inputs:yohualli1 > src/circuits/samples/yohualli-one-attest-public-inputs.txt
 */
import yohualliProofHex from './samples/yohualli-one-attest-proof.hex?raw'
import yohualliPublicInputs from './samples/yohualli-one-attest-public-inputs.txt?raw'

export async function loadYohualliOneAttestSampleFromEmbeds(): Promise<{
  proofHex: string
  publicInputsText: string
}> {
  return {
    proofHex: yohualliProofHex.trim(),
    publicInputsText: yohualliPublicInputs.trim(),
  }
}
