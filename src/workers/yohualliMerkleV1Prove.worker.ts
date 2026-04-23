/// <reference lib="webworker" />
import { runMerkleV1ProveLabCore, type YohualliMerkleV1ProveLabResult, type YohualliMerkleV1ProveLabSuccess } from '@/circuits/yohualliMerkleV1ProveCore'

export type { YohualliMerkleV1ProveLabResult, YohualliMerkleV1ProveLabSuccess as YohualliMerkleV1WorkerProveLabResult }
export type { YohualliMerkleV1ProveLabResult as YohualliMerkleV1ProveWorkerResult }

self.onmessage = (ev: MessageEvent<{ type: 'prove-lab' }>) => {
  if (ev.data?.type === 'prove-lab') {
    void runMerkleV1ProveLabCore('[worker]', undefined).then((out) => {
      postMessage(out)
    })
  }
}
