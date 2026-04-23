#!/usr/bin/env node
/**
 * Yohualli CLI: carga entorno desde archivos **locales** (no imprime secretos) y
 * delega en `yarn run <script>`. Evita `export KEY=… npm run …` (historial, logs).
 *
 * Uso:
 *   yarn yoh:toolbox help
 *   yarn yoh:toolbox check
 *   yarn yoh:toolbox run evm:forge:merkle
 *   yarn yoh:toolbox run lab:derive-evm-roles
 *   yarn yoh:toolbox init
 *   yarn yoh:toolbox shell   # emite un bloque "export …" (revísalo antes; ideal: redirigir a tmp)
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, copyFileSync, chmodSync, statSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.join(__dirname, '..')

const FORGE_FILE = path.join(REPO, '.env.forge.local')
const VITE_FILE = path.join(REPO, '.env.local')
const EXAMPLE = path.join(REPO, '.env.example')
const FORGE_EX = path.join(REPO, '.env.forge.example')

function parseEnvFile(p) {
  if (!existsSync(p)) return {}
  const out = {}
  for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/)
    if (!m) continue
    const k = m[1]
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[k] = v
  }
  return out
}

function mergeEnv() {
  const a = parseEnvFile(FORGE_FILE)
  const b = parseEnvFile(VITE_FILE)
  return { ...a, ...b, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) }
}

function hasSecretKey(name) {
  return /KEY|MNEMONIC|SECRET|PASSPHRASE|TOKEN|PASSWORD/i.test(name)
}

function check() {
  console.log('Repositorio:', REPO)
  for (const [label, f] of [
    ['.env.forge.local (Forge / shell no-Vite)', FORGE_FILE],
    ['.env.local (Vite, solo VITE_ público)', VITE_FILE],
  ]) {
    const ex = existsSync(f)
    console.log(`\n[${ex ? '✓' : '○'}] ${label}`)
    if (!ex) {
      console.log('    (falta; `yarn yoh:toolbox init` o copiá desde .env*.example)')
      continue
    }
    const o = parseEnvFile(f)
    const keys = Object.keys(o)
    console.log(`    claves: ${keys.length} (${keys.filter((k) => hasSecretKey(k)).length} con nombre sensible)`)
    for (const k of keys.sort()) {
      if (hasSecretKey(k)) {
        const v = o[k] || ''
        const h = createHash('sha256').update(v).digest('hex').slice(0, 8)
        console.log(`    - ${k} = <oculto> (sha256…${h})`)
      } else {
        const v = o[k] ?? ''
        const short = v.length > 64 ? `${v.slice(0, 32)}…` : v
        console.log(`    - ${k} = ${short || '(vacío)'}`)
      }
    }
  }
  console.log('\nNo se debe usar `VITE_` para mnemónicas ni private keys (Vite expone al cliente).')
}

function run(scriptName) {
  if (!scriptName) {
    console.error('Uso: yarn yoh:toolbox run <script-de-package.json>')
    process.exit(1)
  }
  const env = mergeEnv()
  const bin = process.platform === 'win32' ? 'yarn.cmd' : 'yarn'
  const p = spawn(bin, ['run', scriptName], {
    cwd: REPO,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  p.on('exit', (c) => process.exit(c ?? 0))
}

async function init() {
  if (!existsSync(VITE_FILE) && existsSync(EXAMPLE)) {
    copyFileSync(EXAMPLE, VITE_FILE)
    try {
      chmodSync(VITE_FILE, 0o600)
    } catch {
      /* ignore */
    }
    console.log('Creado', VITE_FILE, '(desde .env.example) — edita direcciones / RPC.')
  } else if (existsSync(VITE_FILE)) {
    console.log('Ya existe', VITE_FILE, '— no se toca.')
  } else {
    console.log('Falta .env.example; no se pudo crear .env.local')
  }
  if (!existsSync(FORGE_FILE) && existsSync(FORGE_EX)) {
    copyFileSync(FORGE_EX, FORGE_FILE)
    try {
      chmodSync(FORGE_FILE, 0o600)
    } catch {
      /* ignore */
    }
    console.log('Creado', FORGE_FILE, '— rellená RPC_URL y credenciales (sin VITE_).')
  } else if (existsSync(FORGE_FILE)) {
    console.log('Ya existe', FORGE_FILE, '— no se toca.')
  }
}

async function shellHints() {
  const env = mergeEnv()
  const lines = Object.keys(env)
    .filter((k) => k !== '_')
    .sort()
    .map((k) => {
      if (hasSecretKey(k)) return `export ${k}='<REDACTED use .env.forge.local>'`
      return `export ${k}='${(env[k] || '').replace(/'/g, "'\\''")}'`
    })
  console.log('# Pegar en un sub-shell (revisar); mejor: `yarn yoh:toolbox run <script>`\n')
  console.log(lines.join('\n'))
}

async function deriveInteractive() {
  const rl = createInterface({ input, output })
  const def = path.join(REPO, '.yohualli-mnemonic.tmp')
  console.log(
    'Ruta a archivo con la frase (una línea) [defecto: ' + def + '], o Enter y se pedirá pegar (menos seguro, puede mostrarse):'
  )
  const p = (await rl.question('> ')).trim()
  let phrase
  if (p) {
    phrase = readFileSync(p, 'utf8').trim().split('\n')[0]
  } else {
    console.log('Pegá la frase (Enter al final; en muchas terminales se verá la línea):')
    phrase = (await rl.question('> ')).trim()
  }
  rl.close()
  if (!phrase) {
    console.error('Frase vacía')
    process.exit(1)
  }
  const env = { ...process.env, YOHUALLI_LAB_MNEMONIC: phrase }
  const s = spawn(process.execPath, [path.join(REPO, 'scripts/yohualli-derive-evm-lab-roles.mjs')], {
    cwd: REPO,
    env,
    stdio: 'inherit',
  })
  s.on('exit', (c) => {
    if (p) {
      /* ok */
    } else {
      console.log('\n(Aviso: frase tecleada/pegada: vaciá el historial del shell si aplica o usá un archivo con chmod 600).')
    }
    process.exit(c ?? 0)
  })
}

function help() {
  console.log(`yohualli-toolbox
  check              variables cargadas (hashes p/ secretos)
  init               copia .env.example → .env.local y .env.forge.example → .env.forge.local
  run <npm-script>   merge .env.forge.local + .env.local + entorno y yarn run
  shell              pistas export (se ocultan nombres sensibles)
  derive-interactive  deriva m/44'/60'/0'/0/0 y m/44'/60'/10'/0/0 (viem); preferí archivo
`)
}

const [, , cmd, arg] = process.argv
const c = cmd || 'help'
if (c === 'help' || c === '-h' || c === '--help') help()
else if (c === 'check') check()
else if (c === 'init') init().then(() => {})
else if (c === 'run') run(arg)
else if (c === 'shell') shellHints().then(() => {})
else if (c === 'derive-interactive') deriveInteractive()
else {
  console.error('Comando desconocido:', c)
  help()
  process.exit(1)
}
