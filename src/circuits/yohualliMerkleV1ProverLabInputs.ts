import { privateKeyToAccount } from 'viem/accounts'
import { hexToBytes, type Hex } from 'viem'
import type { InputMap } from '@noir-lang/types'

import { LAB_TRUSTED_SEED_MERKLE_ROOT_SINGLE_LEAF } from '@/circuits/labTrustedSeedMerkleRootV0'

const DEFAULT_LAB_PRIVATE_KEY: Hex =
  (import.meta.env.VITE_YOHUALLI_CIRCUIT_LAB_PK as Hex | undefined) ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

const DEFAULT_MSG_HASH: Hex = `0x${'11'.repeat(32)}` as const

/**
 * Mismas constantes de lab que `scripts/gen-yohualli-merkle-attest-v1-prover.mjs` (YOHUALLI_LAB_MERKLE_ROOT).
 * `merkle_root` por defecto: hoja simple = `subjectCommitment` v0 del trusted seed (ver
 * `labTrustedSeedMerkleRootV0.ts` + `merkle:root:trusted-seed-leaves` con 1 hoja). Alinear
 * on-chain: `setMerkleRoot(epoch, root)` con el mismo `bytes32`.
 */
export async function getYohualliMerkleV1LabInputMap(opts?: {
  privateKey?: Hex
  messageHash?: Hex
  merkleRoot?: Hex
}): Promise<{ inputMap: InputMap; signer: Hex; merkleRoot: Hex; messageHash: Hex }> {
  const privateKey = opts?.privateKey ?? DEFAULT_LAB_PRIVATE_KEY
  const messageHashHex = (opts?.messageHash ?? DEFAULT_MSG_HASH) as Hex
  const merkleRootHex = (opts?.merkleRoot?.trim() ??
    (import.meta.env.VITE_YOHUALLI_LAB_MERKLE_ROOT as string | undefined)?.trim() ??
    LAB_TRUSTED_SEED_MERKLE_ROOT_SINGLE_LEAF) as Hex

  const messageHash = hexToBytes(messageHashHex)
  if (messageHash.length !== 32) {
    throw new Error('message_hash debe ser 32 bytes')
  }
  const merkleRoot = hexToBytes(merkleRootHex)
  if (merkleRoot.length !== 32) {
    throw new Error('merkleRoot debe ser 32 bytes (66 chars con 0x)')
  }

  const account = privateKeyToAccount(privateKey)
  const signatureHex = await account.sign({ hash: messageHashHex })
  const sig65 = hexToBytes(signatureHex)
  if (sig65.length !== 65) {
    throw new Error('firma ECDSA inválida')
  }
  const r = sig65.subarray(0, 32)
  const s = sig65.subarray(32, 64)
  const _v = sig65[64]
  const signature64 = new Uint8Array(64)
  signature64.set(r, 0)
  signature64.set(s, 32)
  void _v

  const pub = hexToBytes(account.publicKey)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('se esperaba clave pública descomprimida 65 B (0x04…)')
  }
  const publicKeyX = pub.subarray(1, 33)
  const publicKeyY = pub.subarray(33, 65)

  const u8 = (b: Uint8Array) => Array.from(b)
  const inputMap = {
    message_hash: u8(messageHash),
    public_key_x: u8(publicKeyX),
    public_key_y: u8(publicKeyY),
    merkle_root: u8(merkleRoot),
    signature: u8(signature64),
  } satisfies InputMap
  return {
    inputMap,
    signer: account.address,
    merkleRoot: merkleRootHex,
    messageHash: messageHashHex,
  }
}
