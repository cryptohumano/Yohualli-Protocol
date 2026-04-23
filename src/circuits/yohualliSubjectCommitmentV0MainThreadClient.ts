import {
  runSubjectCommitmentV0ProveLabCore,
  type YohualliSubjectCommitmentV0ProveLabOptions,
  type YohualliSubjectCommitmentV0ProveLabResult,
} from '@/circuits/yohualliSubjectCommitmentV0ProveCore'
import { withScreenWakeLockForAsync } from '@/utils/screenWakeLockForAsync'

export type { YohualliSubjectCommitmentV0ProveLabResult, YohualliSubjectCommitmentV0ProveLabOptions }

export function runSubjectCommitmentV0ProveLabInMainThread(
  options?: YohualliSubjectCommitmentV0ProveLabOptions
): Promise<YohualliSubjectCommitmentV0ProveLabResult> {
  return withScreenWakeLockForAsync(() => runSubjectCommitmentV0ProveLabCore('[main]', undefined, options))
}
