#!/usr/bin/env node
/**
 * Un único 0x… con el contenido del fichero de prueba binario de `bb prove`.
 * Uso (siempre desde la raíz del repo):
 *   node scripts/bb-proof-hex.mjs circuits/yohualli_one_attest_sig/target/proof/proof
 */
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) {
  console.error('Uso: node scripts/bb-proof-hex.mjs <ruta_a/proof>')
  process.exit(1)
}
const buf = readFileSync(path)
if (buf.length === 0) {
  console.error('Fichero vacío')
  process.exit(1)
}
console.log('0x' + buf.toString('hex'))
console.error(`# ${buf.length} bytes (prueba binaria)`)
