/**
 * ABI mínima de `YohualliMerkleHonkRegistry` (un contrato: Merkle + `verify` hacia `HonkVerifier`).
 * @see evm/yohualli_honk_verifier/src/YohualliMerkleHonkRegistry.sol
 * Los módulos separados `MerkleRootRegistry` + `YohualliHonkGateway` son solo para tests Foundry.
 */
export const yohualliMerkleHonkRegistryAbi = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'honk', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'setMerkleRoot',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'epoch', type: 'uint256' },
      { name: 'root', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'merkleRoot',
    stateMutability: 'view',
    inputs: [{ name: 'epoch', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'verify',
    stateMutability: 'view',
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'publicInputs', type: 'bytes32[]' },
    ],
    outputs: [{ name: 'ok', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'verifyForEpoch',
    stateMutability: 'view',
    inputs: [
      { name: 'epoch', type: 'uint256' },
      { name: 'proof', type: 'bytes' },
      { name: 'publicInputs', type: 'bytes32[]' },
      { name: 'merkleFieldStart', type: 'uint256' },
    ],
    outputs: [{ name: 'ok', type: 'bool' }],
  },
  { type: 'error', name: 'MerkleRootMismatch', inputs: [] },
  { type: 'error', name: 'PublicInputIndexOutOfBounds', inputs: [] },
  { type: 'error', name: 'HonkNotSet', inputs: [] },
  {
    type: 'function',
    name: 'setOwner',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setHonkVerifier',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'honkVerifier', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'replaceHonkVerifier',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'honkVerifier', type: 'address' }],
    outputs: [],
  },
] as const

/** @deprecated Usar `yohualliMerkleHonkRegistryAbi` y el despliegue de un solo contrato. */
export const yohualliGatewayAbi = yohualliMerkleHonkRegistryAbi

export const merkleRootRegistryAbi = [
  {
    type: 'function',
    name: 'setMerkleRoot',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'epoch', type: 'uint256' },
      { name: 'root', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'merkleRoot',
    stateMutability: 'view',
    inputs: [{ name: 'epoch', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const
