import { runMerkleV1ProveLabCore, type YohualliMerkleV1ProveLabResult } from '@/circuits/yohualliMerkleV1ProveCore'
import { withScreenWakeLockForAsync } from '@/utils/screenWakeLockForAsync'

export type { YohualliMerkleV1ProveLabResult }

/**
 * Misma prueba que el Web Worker, pero en el **hilo principal** (congela la UI minutos en circuitos
 * pesados). Útil si el worker o la vista embebida del IDE provocan *Length is too large*; abrí el
 * dev server en el **puerto real** (consola, p. ej. `https://127.0.0.1:5177`) sin proxy :64926.
 */
export function runMerkleV1ProveLabInMainThread(): Promise<YohualliMerkleV1ProveLabResult> {
  return withScreenWakeLockForAsync(() => runMerkleV1ProveLabCore('[main]'))
}
