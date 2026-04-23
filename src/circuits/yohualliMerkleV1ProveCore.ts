import acvmWasmUrl from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url'
import noircWasmUrl from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url'
import initACVM from '@noir-lang/acvm_js'
import initNoirC from '@noir-lang/noirc_abi'
import { Noir } from '@noir-lang/noir_js'
import type { CompiledCircuit } from '@noir-lang/types'
import { tryUltraHonkProveWithTranscriptFallback } from '@/circuits/bbProveWithTranscriptFallback'
import { createWasmUltraHonkProveHandle } from '@/circuits/bbWasmUltraHonkProveHandle'
import { getYohualliMerkleV1LabInputMap } from '@/circuits/yohualliMerkleV1ProverLabInputs'
import circuitJson from '@/circuits/artifacts/yohualli_merkle_attest_v1.json'

const circuit = circuitJson as unknown as CompiledCircuit

let didInitWASM = false

async function initNoirWasm() {
  if (didInitWASM) {
    return
  }
  await Promise.all([
    initACVM({ module_or_path: fetch(acvmWasmUrl) }),
    initNoirC({ module_or_path: fetch(noircWasmUrl) }),
  ])
  didInitWASM = true
}

function bytesToProofHex0x(proof: Uint8Array): `0x${string}` {
  return `0x${[...proof].map((x) => x.toString(16).padStart(2, '0')).join('')}` as const
}

function publicInputsToLabText(publicInputs: string[]): string {
  return publicInputs
    .map((fieldHex) => {
      const strip = (fieldHex.startsWith('0x') ? fieldHex.slice(2) : fieldHex).toLowerCase()
      const right64 = strip.length >= 64 ? strip.slice(-64) : strip.padStart(64, '0')
      return `0x${right64}` as const
    })
    .join('\n')
}

export type YohualliMerkleV1ProveLabSuccess = {
  ok: true
  proveMs: number
  totalMs: number
  proofHex: `0x${string}`
  publicInputsText: string
  publicInputCount: number
  logLines: string[]
  signer: `0x${string}`
  merkleRoot: `0x${string}`
  messageHash: `0x${string}`
  proofTranscript?: 'keccak' | 'poseidon2'
}

export type YohualliMerkleV1ProveLabError = { ok: false; message: string; stack?: string }

export type YohualliMerkleV1ProveLabResult = YohualliMerkleV1ProveLabSuccess | YohualliMerkleV1ProveLabError

/**
 * Misma lógica para Web Worker o hilo principal: Noir + `UltraHonkBackend` (WASM) y `verifierTarget: 'evm'` (bb.js 5.x).
 * `BackendType.Wasm` explícito (sin sub-worker de bb) vía `createWasmUltraHonkProveHandle`, para evitar workers anidados.
 */
export async function runMerkleV1ProveLabCore(
  logPrefix = '',
  pushLog?: (line: string) => void
): Promise<YohualliMerkleV1ProveLabResult> {
  const logLines: string[] = []
  const push = (s: string) => {
    const t = logPrefix ? `${logPrefix} ${s}` : s
    logLines.push(t)
    pushLog?.(t)
  }
  const t0 = performance.now()
  try {
    await initNoirWasm()
    push('WASM ACVM + noirc_abi listos')
    const { inputMap, signer, merkleRoot, messageHash } = await getYohualliMerkleV1LabInputMap()
    push('Inputs de lab (ECDSA) listos; signer: ' + signer)
    const noir = new Noir(circuit)
    push('Ejecutando testigo (Noir)…')
    const { witness } = await noir.execute(inputMap)
    const t1 = performance.now()
    push(`Noir/witness: ${(t1 - t0).toFixed(0)} ms`)
    const makeBackend = () => createWasmUltraHonkProveHandle(circuit.bytecode)
    const tProve0 = performance.now()
    const { proofData, transcript } = await tryUltraHonkProveWithTranscriptFallback(
      makeBackend,
      witness,
      push
    )
    const tProve1 = performance.now()
    const proveMs = tProve1 - tProve0
    push(
      `UltraHonk generateProof: transcript=${transcript} — ${proveMs.toFixed(0)} ms; n=${proofData.publicInputs.length} públicos`,
    )
    return {
      ok: true,
      proveMs,
      totalMs: performance.now() - t0,
      proofHex: bytesToProofHex0x(proofData.proof),
      publicInputsText: publicInputsToLabText(proofData.publicInputs),
      publicInputCount: proofData.publicInputs.length,
      logLines,
      signer,
      merkleRoot,
      messageHash,
      proofTranscript: transcript,
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    }
  }
}
