/// <reference lib="webworker" />
import { runSubjectCommitmentV0ProveLabCore, type YohualliSubjectCommitmentV0ProveLabResult, type YohualliSubjectCommitmentV0ProveLabSuccess } from '@/circuits/yohualliSubjectCommitmentV0ProveCore'

export type { YohualliSubjectCommitmentV0ProveLabResult, YohualliSubjectCommitmentV0ProveLabSuccess }

self.onmessage = (ev: MessageEvent<{ type: 'prove-lab'; subjectSs58?: string }>) => {
  if (ev.data?.type === 'prove-lab') {
    const { subjectSs58 } = ev.data
    void runSubjectCommitmentV0ProveLabCore('[worker]', undefined, { subjectSs58 }).then((out) => {
      postMessage(out)
    })
  }
}
