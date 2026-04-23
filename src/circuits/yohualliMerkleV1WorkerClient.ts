import ProveWorker from '@/workers/yohualliMerkleV1Prove.worker?worker'
import type { YohualliMerkleV1ProveLabResult } from '@/circuits/yohualliMerkleV1ProveCore'
import { withScreenWakeLockForAsync } from '@/utils/screenWakeLockForAsync'

export type { YohualliMerkleV1ProveLabResult as YohualliMerkleV1WorkerProveLabResult }
export type { YohualliMerkleV1ProveLabResult }
export type YohualliMerkleV1WorkerError = Extract<YohualliMerkleV1ProveLabResult, { ok: false }>

/**
 * Genera prueba y públicos (Merkle v1, EVM) en un **Web Worker** para no bloquear la UI.
 * Carga Barretenberg (WASM) y el circuito `yohualli_merkle_attest_v1` (artefacto en `src/circuits/artifacts/`).
 */
export function runMerkleV1ProveLabInWorker(): Promise<YohualliMerkleV1ProveLabResult> {
  return withScreenWakeLockForAsync(
    () =>
      new Promise((resolve) => {
        const w = new ProveWorker()
        w.onmessage = (ev: MessageEvent<YohualliMerkleV1ProveLabResult>) => {
          w.terminate()
          resolve(ev.data)
        }
        w.onerror = (err) => {
          w.terminate()
          resolve({ ok: false, message: err.message ?? 'Worker error' })
        }
        w.postMessage({ type: 'prove-lab' } as const)
      }),
  )
}
