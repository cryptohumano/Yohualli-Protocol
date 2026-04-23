import type { ProofData } from '@aztec/bb.js'
import { ULTRA_HONK_EVM_PROOF_OPTIONS } from '@/circuits/bbUltraHonkEvmOptions'
import type { UltraHonkProveHandle } from '@/circuits/bbWasmUltraHonkProveHandle'

export type BbProveTranscript = 'keccak' | 'poseidon2'

async function safeDestroy(backend: UltraHonkProveHandle): Promise<void> {
  try {
    await backend.destroy()
  } catch {
    /* no-op */
  }
}

/**
 * 1) EVM: `verifierTarget: 'evm'` (keccak + ZK) en @aztec/bb.js 5.x.
 * 2) Si el wasm devuelve «Length is too large», reintenta con **poseidon2** (`{}` = transcript por defecto).
 * La segunda prueba **no** es intercambiable on-chain con un HonkVerifier EVM+keccak.
 */
export async function tryUltraHonkProveWithTranscriptFallback(
  createBackend: () => Promise<UltraHonkProveHandle>,
  witness: Uint8Array,
  push: (s: string) => void
): Promise<{ proofData: ProofData; transcript: BbProveTranscript }> {
  const b1 = await createBackend()
  try {
    const proofData = await b1.generateProof(witness, ULTRA_HONK_EVM_PROOF_OPTIONS)
    await safeDestroy(b1)
    return { proofData, transcript: 'keccak' }
  } catch (first) {
    await safeDestroy(b1)
    const msg = first instanceof Error ? first.message : String(first)
    if (!msg.includes('Length is too large')) {
      throw first
    }
    push(
      'Reintento: transcript poseidon2 — EVM/keccak en WASM con esta build de @aztec/bb.js sigue devolviendo «Length is too large»…',
    )
    const b2 = await createBackend()
    try {
      const proofData = await b2.generateProof(witness, {})
      await safeDestroy(b2)
      push(
        'Listo con poseidon2. Esta prueba no coincide con un HonkVerifier «EVM+keccak»; para on-chain: `bb prove -t evm` o otra alineación.',
      )
      return { proofData, transcript: 'poseidon2' }
    } catch (second) {
      await safeDestroy(b2)
      const s2 = second instanceof Error ? second.message : String(second)
      const detail = [
        'WASM de @aztec/bb.js: «Length is too large» con EVM (verifierTarget) y con poseidon2; no es Vite ni el parché msgpack.',
        'Mismo testigo, binario `bb` nativo: `bb prove -b <circuito.json> -w <testigo.gz> -t evm --write_vk -o <dir>`.',
        'Alineá Nargo/Noir/`bb` (bbup) o la versión de @aztec/bb.js con tu barretenberg.',
        `Ramas: EVM → ${msg}; poseidon2 → ${s2}`,
      ].join(' ')
      push(detail)
      const err = new Error(
        `WASM Barretenberg: ambos reintentos fallaron (${msg}). Revisá el log del lab; usá \`bb prove\` nativo o alineá versiones.`,
      ) as Error & { cause?: unknown }
      err.cause = second instanceof Error ? second : first
      throw err
    }
  }
}
