#!/usr/bin/env node
/**
 * Reproduce bb.js WASM `generateProof` (subject commitment v0) en Node, sin Vite.
 * Uso: node scripts/debug-bb-wasm-prove-subject.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeAddress } from '@polkadot/util-crypto'
import { keccak256, concat, toHex, hexToBytes } from 'viem'
import { Barretenberg, BackendType, UltraHonkBackend } from '@aztec/bb.js'
import { Noir } from '@noir-lang/noir_js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const SS58 =
  process.env.DEBUG_SUBJECT_SS58?.trim() ?? '5FnBJLXEjEYiGeTgKaxapS2m8WpsTUGp1sj2ZbwMhodQUo9t'

function u8(b) {
  return Array.from(b)
}

async function makeHandle(bytecode) {
  const api = await Barretenberg.new({
    backend: BackendType.Wasm,
    memory: { initial: 1024, maximum: 2 ** 16 },
    threads: 1,
  })
  const u = new UltraHonkBackend(bytecode, api)
  return { u, api }
}

async function main() {
  const circuitJson = JSON.parse(
    readFileSync(join(root, 'src/circuits/artifacts/yohualli_subject_commitment_v0.json'), 'utf8')
  )

  const pk = decodeAddress(SS58)
  if (pk.length !== 32) throw new Error('pk 32B')
  const scHex = keccak256(concat([/** @type {`0x${string}`} */('0x01'), toHex(pk, { size: 32 })]))
  const inputMap = {
    pk: u8(pk),
    subject_commitment: u8(hexToBytes(scHex)),
  }

  const circuit = new Noir(circuitJson)
  const { witness } = await circuit.execute(inputMap)

  for (const [label, opts] of [
    ['verifierTarget evm (bb 5.x)', { verifierTarget: 'evm' }],
    ['poseidon2 (transcript default)', {}],
  ]) {
    const { u, api } = await makeHandle(circuitJson.bytecode)
    process.stdout.write(`  ${label}… `)
    try {
      const p = await u.generateProof(witness, opts)
      console.log(`OK, públicos=${p.publicInputs.length}`)
    } catch (e) {
      console.log('FAIL:', e?.message ?? e)
    } finally {
      try {
        await api.destroy()
      } catch { /* */ }
    }
  }
  console.log(
    '\nSi falla, probá `bb prove` nativo; si OK aquí, el lab debería probar con la misma @aztec/bb.js.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
