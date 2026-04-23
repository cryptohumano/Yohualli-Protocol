import acvmWasmUrl from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url'
import noircWasmUrl from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url'
import initACVM from '@noir-lang/acvm_js'
import initNoirC from '@noir-lang/noirc_abi'
import { Noir } from '@noir-lang/noir_js'
import type { CompiledCircuit } from '@noir-lang/types'
import { tryUltraHonkProveWithTranscriptFallback } from '@/circuits/bbProveWithTranscriptFallback'
import { createWasmUltraHonkProveHandle } from '@/circuits/bbWasmUltraHonkProveHandle'
import { getYohualliSubjectCommitmentV0LabInputMap } from '@/circuits/yohualliSubjectCommitmentV0ProverLabInputs'
import type { Hex } from 'viem'
import circuitJson from '@/circuits/artifacts/yohualli_subject_commitment_v0.json'

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

export type YohualliSubjectCommitmentV0ProveLabSuccess = {
  ok: true
  proveMs: number
  totalMs: number
  proofHex: `0x${string}`
  publicInputsText: string
  publicInputCount: number
  logLines: string[]
  subjectCommitment: Hex
  subjectSs58: string
  /** `poseidon2` si se usó el reintento (no EVM+keccak on-chain tal cual). */
  proofTranscript?: 'keccak' | 'poseidon2'
}

export type YohualliSubjectCommitmentV0ProveLabError = { ok: false; message: string; stack?: string }
export type YohualliSubjectCommitmentV0ProveLabResult =
  | YohualliSubjectCommitmentV0ProveLabSuccess
  | YohualliSubjectCommitmentV0ProveLabError

/** Entradas del prover: SS58 de la PWA; si se omite, se usa VITE o seeds de lab. */
export type YohualliSubjectCommitmentV0ProveLabOptions = {
  subjectSs58?: string
}

/**
 * Apertura `subject commitment` v0: keccak en circuito, sin ECDSA.
 * Misma pila que Merkle v1: Noir + `UltraHonkBackend` (WASM) + EVM (`verifierTarget: 'evm'`, bb.js 5.x).
 */
export async function runSubjectCommitmentV0ProveLabCore(
  logPrefix = '',
  pushLog?: (line: string) => void,
  options?: YohualliSubjectCommitmentV0ProveLabOptions
): Promise<YohualliSubjectCommitmentV0ProveLabResult> {
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
    const { inputMap, subjectSs58, subjectCommitment } = getYohualliSubjectCommitmentV0LabInputMap(
      options,
    )
    push(`Input lab: subject SS58 = ${subjectSs58.slice(0, 8)}... commitment = ${subjectCommitment.slice(0, 10)}...`)
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
      `UltraHonk generateProof: transcript=${transcript} — ${proveMs.toFixed(0)} ms; n=${proofData.publicInputs.length} publicos (32 B -> Fr)`,
    )
    return {
      ok: true,
      proveMs,
      totalMs: performance.now() - t0,
      proofHex: bytesToProofHex0x(proofData.proof),
      publicInputsText: publicInputsToLabText(proofData.publicInputs),
      publicInputCount: proofData.publicInputs.length,
      logLines,
      subjectCommitment,
      subjectSs58,
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
