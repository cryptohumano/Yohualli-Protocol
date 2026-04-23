import { type Hex, hexToBytes, isHex } from 'viem'

/** Normaliza entrada hex (añade 0x, quita espacios). */
export function normalizeHexProof(input: string): Hex {
  const t = input.trim().replace(/\s+/g, '')
  if (!t) throw new Error('Prueba vacía')
  const with0x = t.startsWith('0x') ? t : `0x${t}`
  if (!isHex(with0x)) throw new Error('La prueba debe ser hex válido')
  return with0x
}

/**
 * Convierte líneas de hex (32 bytes = 64 hex chars + opcional 0x) en `bytes32[]`.
 * Una fila por field element (Barretenberg escribe 32 bytes por público).
 */
export function parsePublicInputsLines(text: string): Hex[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const out: Hex[] = []
  for (const line of lines) {
    const with0x = line.startsWith('0x') ? line : `0x${line}`
    if (!isHex(with0x)) {
      throw new Error(`Línea no hex válida: ${line.slice(0, 20)}…`)
    }
    const bytes = hexToBytes(with0x)
    if (bytes.length !== 32) {
      throw new Error(`Cada público debe ser 32 bytes; esta línea tiene ${bytes.length}`)
    }
    out.push(with0x)
  }
  if (out.length === 0) throw new Error('Al menos un public input (32 bytes por línea)')
  return out
}

/**
 * Misma fórmula que `YohualliMerkleHonkRegistry._merkleFrBytes32` / `MerkleRootRegistry`:
 * 32 `bytes32` consecutivos (cada fila es un `Fr` de `bb` con un byte en los 8b bajos) → un `bytes32` (b0 = MSB).
 */
export function packMerkleFrToBytes32(
  publicInputs: readonly Hex[],
  merkleFieldStart: number
): Hex {
  if (merkleFieldStart < 0 || !Number.isInteger(merkleFieldStart)) {
    throw new Error('merkleFieldStart inválido.')
  }
  if (merkleFieldStart + 32 > publicInputs.length) {
    throw new Error(
      `Faltan filas: hace falta al menos ${merkleFieldStart + 32} públicos (tienes ${publicInputs.length}). Ajustá merkleFieldStart o el texto de públicos.`
    )
  }
  let out = 0n
  for (let i = 0; i < 32; i++) {
    const w = publicInputs[merkleFieldStart + i] as Hex
    out = (out << 8n) | (BigInt(w) & 0xffn)
  }
  return `0x${out.toString(16).padStart(64, '0')}` as Hex
}
