#!/usr/bin/env node
/**
 * Calcula un `merkleRoot` (bytes32) a partir de las hojas = `subjectCommitment` v0
 * (`keccak256(0x01 || decodeAddress(ss58))`), misma regla que EIP-712 Yohualli
 * y `MerkleRootRegistry` / `docs/YOHUALLI_MERKLE_PROOF_V0.md` §2.
 *
 * Anclaje on-chain: **mismo** contrato y flujo que Merkle v1
 * `YohualliMerkleHonkRegistry.setMerkleRoot(epoch, root)` + pruebas cuyo
 * `merkle_root` público coincida (hoy: circuito v1; futuro: membresía con path).
 *
 * Fuentes de SS58 (en orden, primer hit con datos):
 *   1) `TRUSTED_SEED_SS58` = coma-separado
 *   2) `VITE_LAB_TRUSTED_SS58` en el proceso o en `.env` (raíz del repo)
 *   3) Hoja fija de lab: `5FnBJLXEjEYiGeTgKaxapS2m8WpsTUGp1sj2ZbwMhodQUo9t` (mismo que `LAB_TRUSTED_SEED_IDENTITIES[0]`)
 *
 * Uso: node scripts/merkle-root-for-trusted-seed-leaves.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeAddress } from '@polkadot/util-crypto'
import { keccak256, concat, toHex } from 'viem'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const DEFAULT_LAB_SS58 = '5FnBJLXEjEYiGeTgKaxapS2m8WpsTUGp1sj2ZbwMhodQUo9t'

function readDotEnvValue(name) {
  const p = join(rootDir, '.env')
  if (!existsSync(p)) return ''
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('#')) continue
    const m = line.match(new RegExp(`^${name}\\s*=\\s*(.*)$`))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

/**
 * Misma fórmula que `buildSubjectCommitmentV0FromSs58` (src/utils/yohualliAttestationEip712.ts).
 */
function subjectCommitmentV0FromSs58(ss58) {
  const pk = decodeAddress(ss58.trim())
  if (pk.length !== 32) {
    throw new Error(`SS58 no produce pk de 32 B: ${ss58.slice(0, 10)}…`)
  }
  return keccak256(concat(['0x01', toHex(pk, { size: 32 })]))
}

/** Empareja e insiere como Solidity `a < b ? keccak(abi.encodePacked(a,b)) : keccak(abi.encodePacked(b,a))`. */
function hashPair(a0x, b0x) {
  const a = a0x.toLowerCase()
  const b = b0x.toLowerCase()
  if (a === b) return keccak256(concat([a0x, b0x]))
  return a < b ? keccak256(concat([a0x, b0x])) : keccak256(concat([b0x, a0x]))
}

/**
 * Nivel inferior: hojas ordenadas (bytes32 en hex); niveles subsecuentes: pares
 * secuenciales, último replicado si impar. Raíz = única entrada del último nivel.
 */
function binaryMerkleRoot(sortedLeaves) {
  if (sortedLeaves.length === 0) {
    throw new Error('al menos una hoja')
  }
  let level = sortedLeaves
  if (level.length === 1) {
    return level[0]
  }
  while (level.length > 1) {
    const next = []
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = i + 1 < level.length ? level[i + 1] : left
      next.push(hashPair(left, right))
    }
    level = next
  }
  return level[0]
}

function parseSs58List() {
  const a = (process.env.TRUSTED_SEED_SS58 || '').trim()
  if (a) {
    return a
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const b = (process.env.VITE_LAB_TRUSTED_SS58 || readDotEnvValue('VITE_LAB_TRUSTED_SS58') || '').trim()
  if (b) {
    return b
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return [DEFAULT_LAB_SS58]
}

function main() {
  const ss58s = parseSs58List()
  const byLeaf = new Map()
  for (const s of ss58s) {
    const c = subjectCommitmentV0FromSs58(s)
    const k = c.toLowerCase()
    if (!byLeaf.has(k)) {
      byLeaf.set(k, { ss58: s, commitment: c })
    }
  }
  const entries = Array.from(byLeaf.values())
  const leaves = entries.map((e) => e.commitment).sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
  const root = binaryMerkleRoot(leaves)

  console.log('--- Hojas (subjectCommitment v0) ---')
  for (const e of entries.sort((x, y) => x.commitment.toLowerCase().localeCompare(y.commitment.toLowerCase()))) {
    console.log(`  ${e.commitment}  <=  ${e.ss58.slice(0, 20)}…`)
  }
  console.log('')
  console.log('Hojas únicas:', leaves.length)
  console.log('merkleRoot (bytes32):', root)
  console.log('')
  console.log('Alinear con YohualliMerkleHonkRegistry:')
  console.log(`  export MERKLE_ROOT=${root}`)
  console.log('  export MERKLE_EPOCH=0   # o el epoch usado en la prueba')
  console.log('  npm run evm:forge:merkle:set-root   # requiere RPC, PRIVATE_KEY/MNEMONIC, YOHUALLI_MERKLE_REGISTRY')
  console.log('')
  console.log(
    'Misma pila on-chain y doc: evm/…/YohualliMerkleHonkRegistry, verifyForEpoch con el Honk cuya VK tenga el merkle_root en el índice correcto (v1 attestation: 96 con 32 Fr).',
  )
}

main()
