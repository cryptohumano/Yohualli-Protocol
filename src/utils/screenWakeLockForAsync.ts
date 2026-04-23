/**
 * iOS/Safari: durante tareas largas (prove WASM), apagar la pantalla o ahorro agresivo
 * puede congelar o recargar la pestaña. `navigator.wakeLock` mantiene la CPU activa; solo
 * hilo **principal** (válido para provers en Web Worker: el orquestador sigue en main).
 * Requiere origen seguro (HTTPS) y Safari iOS 16.4+.
 */
export async function withScreenWakeLockForAsync<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.wakeLock?.request) {
    return work()
  }
  let lock: WakeLockSentinel | null = null
  try {
    try {
      lock = await navigator.wakeLock.request('screen')
    } catch {
      /* permiso, iframe, o navegador sin API */
    }
    return await work()
  } finally {
    if (lock) {
      try {
        await lock.release()
      } catch {
        /* no-op */
      }
    }
  }
}
