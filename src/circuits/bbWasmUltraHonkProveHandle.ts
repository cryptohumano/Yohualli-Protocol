import { Barretenberg, BackendType, UltraHonkBackend } from '@aztec/bb.js'

/**
 * Misma pila que el lab: **WASM** en hilo actual (no `WasmWorker` de bb) para no anidar workers.
 * @aztec/bb.js 5.x: `UltraHonkBackend(bytecode, api)` con `api = await Barretenberg.new({ backend: Wasm, … })`.
 */
export type UltraHonkProveHandle = InstanceType<typeof UltraHonkBackend> & {
  destroy: () => Promise<void>
}

/** Píe iOS: menos pico al reservar memoria WASM (WKWebView mata la pestaña con poca RAM libre). */
function wasmMemoryLimits(): { initial: number; maximum: number } {
  const n = globalThis.navigator
  if (!n?.userAgent) {
    return { initial: 1024, maximum: 2 ** 16 }
  }
  if (
    /iPhone|iPad|iPod/i.test(n.userAgent) ||
    (n.platform === 'MacIntel' && n.maxTouchPoints > 1)
  ) {
    return { initial: 512, maximum: 2 ** 16 }
  }
  return { initial: 1024, maximum: 2 ** 16 }
}

export async function createWasmUltraHonkProveHandle(acirBytecode: string): Promise<UltraHonkProveHandle> {
  const api = await Barretenberg.new({
    backend: BackendType.Wasm,
    memory: wasmMemoryLimits(),
    threads: 1,
  })
  const u = new UltraHonkBackend(acirBytecode, api)
  return Object.assign(u, {
    destroy: () => api.destroy(),
  })
}
