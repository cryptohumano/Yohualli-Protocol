/**
 * ABI mínimo del verificador Barretenberg (HonkVerifier).
 * Incluye errores habituales (generados) para decodificar reverts en `eth_call`.
 */
export const honkVerifierAbi = [
  {
    type: 'function',
    name: 'verify',
    stateMutability: 'view',
    inputs: [
      { name: 'proof', type: 'bytes', internalType: 'bytes' },
      { name: 'publicInputs', type: 'bytes32[]', internalType: 'bytes32[]' },
    ],
    outputs: [{ name: 'verified', type: 'bool', internalType: 'bool' }],
  },
  {
    type: 'error',
    name: 'ProofLengthWrongWithLogN',
    inputs: [
      { name: 'logN', type: 'uint256', internalType: 'uint256' },
      { name: 'actualLength', type: 'uint256', internalType: 'uint256' },
      { name: 'expectedLength', type: 'uint256', internalType: 'uint256' },
    ],
  },
  { type: 'error', name: 'PublicInputsLengthWrong', inputs: [] },
  { type: 'error', name: 'SumcheckFailed', inputs: [] },
  { type: 'error', name: 'ShpleminiFailed', inputs: [] },
] as const
