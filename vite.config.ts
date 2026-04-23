import { createLogger, defineConfig, type Logger, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import os from 'os'
import { fileURLToPath } from 'node:url'

type DevHttpsCredentials = { cert: Buffer; key: Buffer }

/** El paquete publicado de @aztec/bb.js trae .map apuntando a archivos .ts inexistentes; Vite spamea la consola. */
function quietAztecBbSourcemapLogNoise(base: Logger): Logger {
  const drop = (msg: string) =>
    msg.includes('Sourcemap for') && msg.includes('node_modules/@aztec/bb.js') && msg.includes('missing source')
  return {
    ...base,
    info: (msg, o) => {
      if (drop(msg)) return
      base.info(msg, o)
    },
    warn: (msg, o) => {
      if (drop(msg)) return
      base.warn(msg, o)
    },
    warnOnce: (msg, o) => {
      if (drop(msg)) return
      base.warnOnce(msg, o)
    },
  }
}

const aztecQuietLogger = quietAztecBbSourcemapLogNoise(createLogger())

/**
 * Barretenberg: I/O msgpack fija búfer (serie 8 MiB) demasiado pequeño; el `postinstall` parcha `node_modules`,
 * pero caché del SW/navegador o builds viejos pueden servir 8 MiB. Este plugin reescribe el valor en **cada** transform
 * (app + web workers) para forzar un *scratch* adecuado.
 * Rango: 8–256 MiB (2×`bbmalloc` = mucha RAM: no subas sin necesidad; en móvil, bajar a 32–64 si hay OOM).
 * Shell: `BB_MSGPACK_VITE_MIB=64 yarn dev` (no va al bundle, solo a config de Vite).
 * En dev, `load` lee el archivo desde disco y fija el scratch; `no-store` en `@aztec/bb.js` evita caché HTTP con distintas versiones`?v=…`.
 */
const BB_MSGPACK_VITE_MIB = (() => {
  const n = Number(process.env.BB_MSGPACK_VITE_MIB)
  if (Number.isFinite(n) && n >= 8 && n <= 256) {
    return Math.trunc(n)
  }
  // 256: Honk + keccak/EVM en v1/ECDSA aún pisa “Length is too large” con 128 MiB en wasm/msgpack; en móvil, bajar a 64–128 si hay OOM
  return 256
})()

/** @aztec/bb.js: `this.` (≤3) o campo de clase (5.x) */
const MSGPACK_SCRATCH_LINE_RE = /(this\.)?MSGPACK_SCRATCH_SIZE = 1024 \* 1024 \* \d+;[^\n]*/g

function normalizeModuleIdToFsPath(id: string): string {
  const noQuery = id.replace(/\\/g, '/').split('?')[0].split('#')[0]
  if (noQuery.startsWith('file:')) {
    try {
      return fileURLToPath(noQuery)
    } catch {
      return noQuery
    }
  }
  return noQuery
}

function isBarretenbergWasmMainFile(cleanId: string): boolean {
  const n = cleanId.replace(/\\/g, '/')
  // Vite/Rollup: ruta a barretenberg_wasm_main/index.js (Yarn, pnpm @aztec+bb.js@, etc.)
  return n.includes('barretenberg_wasm_main') && n.endsWith('index.js')
}

function barretenbergMsgpackVitePlugin(mib: number): Plugin {
  const lineReplace = (_: string, p1?: string) =>
    `${p1 ?? ''}MSGPACK_SCRATCH_SIZE = 1024 * 1024 * ${mib}; // ${mib}MiB (Vite: barretenberg-wasm-msgpack-scratch)`
  return {
    name: 'barretenberg-wasm-msgpack-scratch',
    /** Antes que el resto de `transform`, y `load` antes de leer de disco, para no servir 8 MiB aunque falle un `transform` previo. */
    enforce: 'pre',
    buildStart() {
      if (process.env.CI) return
      console.log(
        `\x1b[90m[Vite] @aztec/bb.js msgpack scratch: ${mib} MiB (export BB_MSGPACK_VITE_MIB=8..256 to override)\x1b[0m`,
      )
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url
        if (raw) {
          let d = raw
          try {
            d = decodeURI(raw.split('?')[0] ?? raw)
          } catch {
            /* no-op */
          }
          if (d.includes('@aztec/bb.js') || d.includes('aztec%2Fbb.js') || d.includes('aztec%2fbb.js')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
          }
        }
        next()
      })
    },
    load(id) {
      const p = normalizeModuleIdToFsPath(id)
      if (!isBarretenbergWasmMainFile(p)) return null
      if (!fs.existsSync(p)) return null
      let code: string
      try {
        code = fs.readFileSync(p, 'utf-8')
      } catch {
        return null
      }
      MSGPACK_SCRATCH_LINE_RE.lastIndex = 0
      if (!MSGPACK_SCRATCH_LINE_RE.test(code)) return null
      MSGPACK_SCRATCH_LINE_RE.lastIndex = 0
      return code.replace(MSGPACK_SCRATCH_LINE_RE, lineReplace as (substring: string, ...args: string[]) => string)
    },
    transform(code, id) {
      // Defensa: si `load` no aplicó (p. ej. `id` virtual raro), seguimos parcheando el `transform`.
      const p = normalizeModuleIdToFsPath(id)
      if (!isBarretenbergWasmMainFile(p)) return null
      MSGPACK_SCRATCH_LINE_RE.lastIndex = 0
      if (!MSGPACK_SCRATCH_LINE_RE.test(code)) {
        MSGPACK_SCRATCH_LINE_RE.lastIndex = 0
        return null
      }
      MSGPACK_SCRATCH_LINE_RE.lastIndex = 0
      return { code: code.replace(MSGPACK_SCRATCH_LINE_RE, lineReplace as (m: string, p1?: string) => string), map: null }
    },
  }
}

// Certificados SSL locales (mkcert); ver scripts/setup-https.sh
const httpsCredentials: DevHttpsCredentials | null = (() => {
  const certPath = path.resolve(__dirname, '.certs/cert.pem')
  const keyPath = path.resolve(__dirname, '.certs/key.pem')
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    }
  }
  return null
})()

/** HTTPS en dev si hay `.certs/`. Necesario para `crypto.subtle` en el móvil vía IP LAN (contexto seguro). */
const useHttpsInDev =
  httpsCredentials !== null && process.env.VITE_DEV_PLAIN_HTTP !== '1'

/** Prioriza subredes típicas de LAN frente a Docker/bridge u otras. */
function scoreLanAddress(addr: string): number {
  if (addr.startsWith('192.168.')) return 300
  if (addr.startsWith('10.')) return 280
  const m = /^172\.(\d+)\./.exec(addr)
  if (m) {
    const oct2 = Number.parseInt(m[1], 10)
    if (oct2 >= 16 && oct2 <= 31) return 260
  }
  if (addr.startsWith('169.254.')) return 50
  return 100
}

/** Primera IPv4 no loopback; la más “probable” para Wi‑Fi/Ethernet doméstico. */
function getLocalIP(): string {
  try {
    const interfaces = os.networkInterfaces()
    if (!interfaces) return 'localhost'
    const candidates: string[] = []
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          candidates.push(iface.address)
        }
      }
    }
    if (candidates.length === 0) return 'localhost'
    candidates.sort((a, b) => scoreLanAddress(b) - scoreLanAddress(a))
    return candidates[0]
  } catch {
    return 'localhost'
  }
}

/** Imprime URL LAN al levantar el dev server (misma Wi‑Fi que el teléfono). */
function devLanHintPlugin(opts: { https: boolean }): Plugin {
  return {
    name: 'aura-dev-lan-hint',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        const port =
          typeof addr === 'object' && addr && 'port' in addr && addr.port != null
            ? Number(addr.port)
            : 5173
        const ip = process.env.VITE_DEV_LAN_IP?.trim() || getLocalIP()
        const proto = opts.https ? 'https' : 'http'
        console.log('\n\x1b[36m[Yohualli]\x1b[0m Desde el teléfono (misma red Wi‑Fi):')
        console.log(`\x1b[36m  →\x1b[0m ${proto}://${ip}:${port}/`)
        if (!opts.https) {
          console.log(
            '\x1b[33m  ⚠ Sin HTTPS: el navegador del móvil no expone crypto.subtle en http://IP-LAN.\x1b[0m'
          )
          console.log(
            '\x1b[33m    Ejecuta: bash scripts/setup-https.sh  luego reinicia yarn dev (usa .certs/ automáticamente).\x1b[0m'
          )
          console.log(
            '\x1b[90m    En el móvil, "localhost" es el propio teléfono, no tu PC; usa la IP de tu ordenador.\x1b[0m'
          )
        } else {
          console.log(
            '\x1b[90m  Si el navegador avisa del certificado: instala la CA de mkcert en el móvil (ver salida de setup-https.sh).\x1b[0m'
          )
        }
        if (process.env.VITE_PWA_DEV === '1') {
          console.log('\x1b[90m  PWA: Service Worker activo en dev (VITE_PWA_DEV=1).\x1b[0m')
        } else {
          console.log(
            '\x1b[90m  PWA: Service Worker desactivado en dev (evita precache + proxy IDE → ERR_EMPTY_RESPONSE). VITE_PWA_DEV=1 para probar PWA.\x1b[0m'
          )
        }
        console.log(
          '\x1b[90m  Vista previa embebida (p. ej. Cursor en puerto distinto): abre la app en http://127.0.0.1:' +
            port +
            ' en el navegador del sistema, o define VITE_DEV_SERVER_ORIGIN + VITE_DEV_HMR_CLIENT_PORT (ver comentario en vite.config).\x1b[0m'
        )
        if (process.env.VITE_DEV_HMR_HOST) {
          console.log(`\x1b[90m  HMR host:\x1b[0m ${process.env.VITE_DEV_HMR_HOST} (VITE_DEV_HMR_HOST)\n`)
        } else if (!opts.https) {
          console.log(
            '\x1b[90m  Si con HTTP la recarga en vivo falla por IP, define VITE_DEV_HMR_HOST=<esta-ip>.\x1b[0m\n'
          )
        } else {
          console.log('')
        }
      })
    },
  }
}

// Detectar si estamos en GitHub Pages
// Si el repositorio no es username.github.io, necesitamos el base path
const getBase = () => {
  // Si hay una variable de entorno VITE_BASE_URL, usarla (útil para testing)
  if (process.env.VITE_BASE_URL) {
    return process.env.VITE_BASE_URL
  }
  
  // En desarrollo, no usar base
  if (process.env.NODE_ENV === 'development') {
    return '/'
  }
  
  // En producción (build), usar el nombre del repositorio como base si existe
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  // Si el repo es username.github.io, usar /, sino usar /repo-name/
  if (repoName && !repoName.includes('.github.io')) {
    return `/${repoName}/`
  }
  return '/'
}

// Calcular el base path dinámicamente (se recalcula cada vez que se accede)
// Esto asegura que las variables de entorno estén disponibles durante el build
const basePath = getBase()

// Log para debugging (solo en build)
if (process.env.NODE_ENV === 'production') {
  console.log('[Vite Config] Base path:', basePath)
  console.log('[Vite Config] GITHUB_REPOSITORY:', process.env.GITHUB_REPOSITORY)
  console.log('[Vite Config] NODE_ENV:', process.env.NODE_ENV)
  
  // Verificar que el base path sea correcto
  if (!basePath || basePath === '/') {
    console.warn('[Vite Config] ⚠️ Base path es "/". Si estás desplegando en GitHub Pages, esto podría causar problemas.')
    console.warn('[Vite Config] GITHUB_REPOSITORY debería estar configurado en el workflow de GitHub Actions.')
  }
}

/** Relay gossip local (`npm run relay:yohualli`); el navegador usa el proxy para no depender de 127.0.0.1 en el cliente. Sin prefijo `VITE_` (solo config de Node, no va al bundle). */
const yohualliRelayProxyTarget =
  process.env.YOHUALLI_RELAY_PROXY_TARGET?.trim() ||
  process.env.VITE_YOHUALLI_RELAY_PROXY_TARGET?.trim() ||
  'http://127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  customLogger: aztecQuietLogger,
  /** Web Workers: formato ES (recomendado si se añaden workers al bundle). */
  worker: {
    format: 'es',
  },
  server: {
    host: '0.0.0.0', // Escuchar en todas las interfaces (acceso LAN / teléfono)
    port: 5173,
    ...(useHttpsInDev && httpsCredentials ? { https: httpsCredentials } : {}),
    strictPort: true,
    proxy: {
      // Mismo origen que Vite → útil si el browser no comparte loopback con donde corre el relay (IDE, SSH, etc.)
      '/__yohualli_relay': {
        target: yohualliRelayProxyTarget,
        changeOrigin: true,
        ws: true,
        rewrite: () => '/',
      },
    },
    // Origen “real” del dev server (p. ej. http://127.0.0.1:5173) si accedés por proxy IDE en otro puerto:
    // los assets y el cliente HMR apuntan ahí y evitan ERR_EMPTY_RESPONSE en recursos de /public.
    ...(process.env.VITE_DEV_SERVER_ORIGIN?.trim()
      ? { origin: process.env.VITE_DEV_SERVER_ORIGIN.trim().replace(/\/$/, '') }
      : {}),
    ...(process.env.VITE_DEV_SERVER_ORIGIN?.trim()
      ? {}
      : process.env.VITE_DEV_HMR_HOST?.trim() || process.env.VITE_DEV_HMR_CLIENT_PORT?.trim()
        ? {
            hmr: {
              host: process.env.VITE_DEV_HMR_HOST?.trim() || 'localhost',
              port: 5173,
              clientPort: process.env.VITE_DEV_HMR_CLIENT_PORT?.trim()
                ? Number(process.env.VITE_DEV_HMR_CLIENT_PORT)
                : 5173,
              ...(useHttpsInDev ? { protocol: 'wss' as const } : { protocol: 'ws' as const }),
            },
          }
        : {}),
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    ...(useHttpsInDev && httpsCredentials ? { https: httpsCredentials } : {}),
    proxy: {
      '/__yohualli_relay': {
        target: yohualliRelayProxyTarget,
        changeOrigin: true,
        ws: true,
        rewrite: () => '/',
      },
    },
  },
  plugins: [
    barretenbergMsgpackVitePlugin(BB_MSGPACK_VITE_MIB),
    devLanHintPlugin({ https: useHttpsInDev }),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      base: getBase(),
      scope: getBase(),
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: basePath === '/' ? '/index.html' : basePath + 'index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        // Excluir servicios de mapas del procesamiento de Workbox completamente
        // Esto previene que Workbox intente procesar estas URLs
        navigateFallbackAllowlist: undefined,
        // Límite alto por si algún chunk grande entra al precache
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        runtimeCaching: [
          {
            // Regla específica para staticmap - NetworkOnly para que no intente cachear
            // Esta regla debe ir ANTES de la regla general para tener prioridad
            urlPattern: /^https:\/\/.*staticmap\.openstreetmap\.(de|org|fr)\/.*/,
            handler: 'NetworkOnly',
            options: {
              // No cachear nada, solo intentar la red
              // Si falla, el error se propaga normalmente al componente sin que Workbox interfiera
            }
          },
          {
            // Regla general para otros recursos externos
            // Excluir explícitamente staticmap para que use la regla anterior (NetworkOnly)
            urlPattern: ({ url }: { url: URL }) => {
              // Solo procesar URLs HTTPS que NO sean de staticmap
              return url.protocol === 'https:' && !url.hostname.includes('staticmap.openstreetmap')
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 horas
              },
              matchOptions: {
                ignoreSearch: false,
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Yohualli Protocol',
        short_name: 'Yohualli',
        description: 'Wallet criptográfica segura y privada para redes Substrate/Polkadot con WebAuthn, multi-cadena y gestión de identidad',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: getBase(),
        categories: ['finance', 'utilities', 'productivity'],
        lang: 'es',
        dir: 'ltr',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [],
        shortcuts: [
          {
            name: 'Inicio',
            short_name: 'Inicio',
            description: 'Ver resumen de cuentas y balances',
            url: basePath,
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Enviar',
            short_name: 'Enviar',
            description: 'Enviar tokens a otra dirección',
            url: basePath + 'send',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Cuentas',
            short_name: 'Cuentas',
            description: 'Gestionar cuentas del wallet',
            url: basePath + 'accounts',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Identidad',
            short_name: 'Identidad',
            description: 'Gestionar identidad y privacidad',
            url: basePath + 'identity',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      devOptions: {
        // En dev, el SW precachea /public y rompe detrás de proxies del IDE (p. ej. localhost:64926).
        enabled: process.env.VITE_PWA_DEV === '1',
        type: 'module',
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      util: 'util',
      stream: 'stream-browserify',
      string_decoder: 'string_decoder',
      assert: 'assert',
      buffer: 'buffer',
      process: 'process/browser',
      pino: 'pino/browser.js',
    },
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
    'process.browser': true,
  },
  optimizeDeps: {
    exclude: ['@aztec/bb.js'],
    include: [
      'util',
      'stream-browserify',
      'string_decoder',
      'assert',
      'process',
      'buffer',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})

