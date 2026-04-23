import ProveWorker from '@/workers/yohualliSubjectCommitmentV0Prove.worker?worker'
import type {
  YohualliSubjectCommitmentV0ProveLabOptions,
  YohualliSubjectCommitmentV0ProveLabResult,
} from '@/circuits/yohualliSubjectCommitmentV0ProveCore'
import { withScreenWakeLockForAsync } from '@/utils/screenWakeLockForAsync'

export type { YohualliSubjectCommitmentV0ProveLabResult, YohualliSubjectCommitmentV0ProveLabOptions }

/**
 * `yohualli_subject_commitment_v0` (keccak opening) en Web Worker.
 */
export function runSubjectCommitmentV0ProveLabInWorker(
  options?: YohualliSubjectCommitmentV0ProveLabOptions
): Promise<YohualliSubjectCommitmentV0ProveLabResult> {
  return withScreenWakeLockForAsync(
    () =>
      new Promise((resolve) => {
        const w = new ProveWorker()
        w.onmessage = (ev: MessageEvent<YohualliSubjectCommitmentV0ProveLabResult>) => {
          w.terminate()
          resolve(ev.data)
        }
        w.onerror = (err) => {
          w.terminate()
          resolve({ ok: false, message: err.message ?? 'Worker error' })
        }
        w.postMessage({ type: 'prove-lab', subjectSs58: options?.subjectSs58 } as const)
      }),
  )
}
