#!/usr/bin/env node
/**
 * Aumenta `MSGPACK_SCRATCH` en `barretenberg_wasm_main` (I/O in-out con el WASM) por encima
 * del 8 MiB de serie; sin eso, `generateProof` puede fallar con *Length is too large* (C++/WASM)
 * aun con circuitos medianos (keccak, etc.).
 *
 * Sustituye **cualquier** valor previo (8, 64, 128…) para que `postinstall` pueda subir
 * de versión sin atascarse (antes solo se matcheaba 8MB).
 * Override: `BB_MSGPACK_MB=128` (2×esa RAM en bbmalloc) si un dispositivo se queda sin memoria; por **defecto 256** (máx. 256).
 * En **Vite** el scratch se ajusta otra vez en `barretenbergMsgpackVitePlugin` (vite.config); variable `BB_MSGPACK_VITE_MIB` (8–256).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const raw = process.env.BB_MSGPACK_MB
const MB = Math.min(256, Math.max(8, Number(raw && String(raw).trim() !== '' ? raw : 256) || 256))
/** @aztec/bb.js ≤3: `this.MSGPACK_SCRATCH_SIZE = …`; 5.x: campo de clase `MSGPACK_SCRATCH_SIZE = …` */
const anyPrev = /(this\.)?MSGPACK_SCRATCH_SIZE = 1024 \* 1024 \* \d+;[^\n]*/g
const relPaths = [
  'node_modules/@aztec/bb.js/dest/browser/barretenberg_wasm/barretenberg_wasm_main/index.js',
  'node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg_wasm_main/index.js',
  'node_modules/@aztec/bb.js/dest/node-cjs/barretenberg_wasm/barretenberg_wasm_main/index.js',
]

let changed = 0
for (const rel of relPaths) {
  const p = path.join(root, rel)
  if (!fs.existsSync(p)) {
    process.stderr.write(`[patch-bb] omitido (no existe): ${rel}\n`)
    continue
  }
  const s0 = fs.readFileSync(p, 'utf8')
  if (s0.includes(`1024 * 1024 * ${MB};`) && s0.includes('parchado, ver patch-aztec-bb-msgpack-scratch.mjs')) {
    continue
  }
  if (!anyPrev.test(s0)) {
    process.stderr.write(`[patch-bb] no se encontró MSGPACK_SCRATCH en ${rel}\n`)
    anyPrev.lastIndex = 0
    continue
  }
  anyPrev.lastIndex = 0
  const s1 = s0.replace(
    anyPrev,
    (_, p1) =>
      `${p1 ?? ''}MSGPACK_SCRATCH_SIZE = 1024 * 1024 * ${MB}; // ${MB}MB (parchado, ver patch-aztec-bb-msgpack-scratch.mjs)`,
  )
  if (s1 === s0) {
    process.stderr.write(`[patch-bb] sin cambio en ${rel}\n`)
    continue
  }
  fs.writeFileSync(p, s1, 'utf8')
  changed += 1
  process.stdout.write(`[patch-bb] ${rel} -> ${MB}MB msgpack scratch\n`)
}
if (changed === 0) {
  const anyExists = relPaths.some((r) => fs.existsSync(path.join(root, r)))
  if (anyExists) {
    process.stdout.write(`[patch-bb] nada que cambiar (ya en ${MB}MB o reglas distintas)\n`)
  } else {
    process.stderr.write('[patch-bb] @aztec/bb.js no encontrado; ejecuta yarn install\n')
  }
}
