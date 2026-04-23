#!/usr/bin/env node
/**
 * Convierte el fichero binario `public_inputs` de `bb prove` a líneas hex (32 B por línea)
 * para pegar en ZK Lab (un bytes32 por fila).
 *
 * Ejecutar **desde la raíz del repositorio** (donde está `package.json`):
 *   npm run circuit:public-inputs:yohualli1
 *   # o, con ruta explícita:
 *   node scripts/bb-public-inputs-hex-lines.mjs circuits/yohualli_one_attest_sig/target/proof/public_inputs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const path = process.argv[2]
if (!path) {
  console.error('Uso: node scripts/bb-public-inputs-hex-lines.mjs <ruta_a/public_inputs>')
  process.exit(1)
}
const buf = readFileSync(path)
if (buf.length % 32 !== 0) {
  console.error(
    `Tamaño ${buf.length} no múltiplo de 32; ¿es realmente public_inputs de bb?`,
  )
  process.exit(1)
}
for (let i = 0; i < buf.length; i += 32) {
  console.log('0x' + buf.subarray(i, i + 32).toString('hex'))
}
console.error(`# ${buf.length / 32} filas (bytes32)`)
