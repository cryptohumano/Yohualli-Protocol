#!/usr/bin/env node
/**
 * Genera `circuits/yohualli_one_attest_sig/Prover.toml` para el circuito de 1× ECDSA.
 *
 * Usa viem: misma semántica que firmar el digest EIP-712 (32 bytes) con la EOA de atestación.
 * Clave fija de laboratorio (NUNCA mainnet / fondos reales).
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { privateKeyToAccount } from 'viem/accounts'
import { hexToBytes } from 'viem'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outPath = join(root, 'circuits', 'yohualli_one_attest_sig', 'Prover.toml')

/** Clave de prueba determinista (32 bytes hex). Sustituir por clave de lab si hace falta. */
const LAB_PRIVATE_KEY =
  process.env.YOHUALLI_CIRCUIT_LAB_PK ??
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

function bytesToToml(name, u8) {
  return `${name} = [${Array.from(u8).join(', ')}]`
}

const account = privateKeyToAccount(LAB_PRIVATE_KEY)

/** Digest fijo 32 B (sustituir por keccak del dominio+struct en flujo real). */
const messageHashHex = `0x${'11'.repeat(32)}` // 32 bytes
const messageHash = hexToBytes(messageHashHex)

const signatureHex = await account.sign({ hash: messageHashHex })
const sig65 = hexToBytes(signatureHex)
if (sig65.length !== 65) {
  throw new Error(`firma inesperada: ${sig65.length} bytes`)
}
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
  '# Generado por scripts/gen-yohualli-one-attest-prover.mjs',
  '# message_hash: digest de 32 B (laboratorio); en prod = digest EIP-712 v0',
  bytesToToml('message_hash', messageHash),
  bytesToToml('public_key_x', publicKeyX),
  bytesToToml('public_key_y', publicKeyY),
  bytesToToml('signature', signature64),
  '',
  '# v = ' + v + ' (no entra al circuito; la verificación es r||s vs hash + pk)',
  '',
]
writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log('Escrito', outPath)
console.log('signer (EOA):', account.address)
console.log('s probado BIP-62: revisar en docs Noir si verificación falla (ajustar s)')
