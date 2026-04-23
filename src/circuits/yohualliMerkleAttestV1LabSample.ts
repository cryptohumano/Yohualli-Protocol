/**
 * Prueba + públicos para `circuits/yohualli_merkle_attest_v1` (misma corrida `bb prove` que el HonkVerifier copiado).
 * Regenerar: `npm run circuit:proof-hex:yohualli-merkle-v1` y `npm run circuit:public-inputs:yohualli-merkle-v1`
 */
import proofHex from './samples/yohualli-merkle-attest-v1-proof.hex?raw'
import publicInputs from './samples/yohualli-merkle-attest-v1-public-inputs.txt?raw'

export const YOHUALLI_MERKLE_ATTEST_V1_MERKLE_FR_START = 96

export async function loadYohualliMerkleAttestV1SampleFromEmbeds(): Promise<{
  proofHex: string
  publicInputsText: string
}> {
  return {
    proofHex: proofHex.trim(),
    publicInputsText: publicInputs.trim(),
  }
}
