#!/usr/bin/env node
/**
 * Genera `circuits/yohualli_merkle_attest_v1/Prover.toml` (ECDSA v0 + merkle_root público de lab).
 * `merkle_root` debe coincidir con el root que fijes on-chain con `setMerkleRoot` para probar `verifyForEpoch`.
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeAddress } from '@polkadot/util-crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { concat, hexToBytes, keccak256, toHex } from 'viem'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outPath = join(root, 'circuits', 'yohualli_merkle_attest_v1', 'Prover.toml')

const LAB_PRIVATE_KEY =
  process.env.YOHUALLI_CIRCUIT_LAB_PK ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

const FALLBACK_LAB_SS58 = '5FnBJLXEjEYiGeTgKaxapS2m8WpsTUGp1sj2ZbwMhodQUo9t'

/** Misma fórmula v0 que hoja single-leaf: `keccak(0x01 || pk)`.
 * Override: YOHUALLI_LAB_MERKLE_ROOT=0x… o LAB_TRUSTED_SEED_DEFAULT_SS58. */
function merkleRootV0ForSs58(ss58) {
  const pk = decodeAddress(ss58.trim())
  if (pk.length !== 32) throw new Error('pk 32B')
  return keccak256(concat(['0x01', toHex(pk, { size: 32 })]))
}

const merkleRootHex =
  process.env.YOHUALLI_LAB_MERKLE_ROOT?.trim() ??
  merkleRootV0ForSs58(process.env.LAB_TRUSTED_SEED_DEFAULT_SS58?.trim() ?? FALLBACK_LAB_SS58)

function bytesToToml(name, u8) {
  return `${name} = [${Array.from(u8).join(', ')}]`
}

const account = privateKeyToAccount(LAB_PRIVATE_KEY)
const messageHashHex = `0x${'11'.repeat(32)}`
const messageHash = hexToBytes(messageHashHex)

const merkleRoot = hexToBytes(/** @type {`0x${string}`} */ (merkleRootHex))
if (merkleRoot.length !== 32) {
  throw new Error('YOHUALLI_LAB_MERKLE_ROOT debe ser 32 bytes (66 chars con 0x)')
}

const signatureHex = await account.sign({ hash: messageHashHex })
const sig65 = hexToBytes(signatureHex)
const r = sig65.subarray(0, 32)
const s = sig65.subarray(32, 64)
const v = sig65[64]
const signature64 = new Uint8Array(64)
signature64.set(r, 0)
signature64.set(s, 32)

const pub = hexToBytes(account.publicKey)
if (pub.length !== 65 || pub[0] !== 0x04) {
  throw new Error('se esperaba clave pública no comprimida 65 bytes 0x04…')
}
const publicKeyX = pub.subarray(1, 33)
const publicKeyY = pub.subarray(33, 65)

const lines = [
  '# Generado por scripts/gen-yohualli-merkle-attest-v1-prover.mjs',
  '# merkle_root: subjectCommitment v0 (1 hoja) o YOHUALLI_LAB_MERKLE_ROOT; = setMerkleRoot + merkle:root:trusted-seed-leaves',
  bytesToToml('message_hash', messageHash),
  bytesToToml('public_key_x', publicKeyX),
  bytesToToml('public_key_y', publicKeyY),
  bytesToToml('merkle_root', merkleRoot),
  bytesToToml('signature', signature64),
  '',
  '# v = ' + v,
  '',
]
writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log('Escrito', outPath)
console.log('signer (EOA):', account.address)
console.log('merkle_root (32 B):', merkleRootHex)
