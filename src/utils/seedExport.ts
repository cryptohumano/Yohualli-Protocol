import { keyExtractSuri } from '@polkadot/util-crypto'

const BIP39_LENGTHS = new Set([12, 15, 18, 21, 24])
const SECP_32_HEX = /^(0x)?[0-9a-fA-F]{64}$/

export type Bip39DerivationMaterial = {
  kind: 'bip39'
  /** Frase (solo palabras) */
  words: string
  hasBip39Passphrase: boolean
  /** SURI almacenada (Substrate, /// pass, etc.) */
  fullSuri: string
}

export type RawKeyDerivationMaterial = {
  kind: 'raw_key'
  /** Clave 0x+64 o 64 sin prefijo, tal como almacenó el usuario. */
  hex: string
}

/**
 * Clasifica el `hdDerivationSuri` en memoria (no persiste) para mostrar
 * o copiar con consentimiento, sin tocar almacenamiento cifrado.
 */
export function parseDerivationMaterial(suri: string | undefined): Bip39DerivationMaterial | RawKeyDerivationMaterial | null {
  if (!suri) return null
  const t = suri.trim()
  if (!t) return null
  if (SECP_32_HEX.test(t)) {
    const h = t.startsWith('0x') || t.startsWith('0X') ? t : `0x${t}`
    return { kind: 'raw_key', hex: h }
  }
  try {
    const ex = keyExtractSuri(t.normalize('NFC'))
    const w = ex.phrase.split(/\s+/).filter(Boolean)
    if (!BIP39_LENGTHS.has(w.length)) return null
    return {
      kind: 'bip39',
      words: ex.phrase,
      hasBip39Passphrase: ex.password != null && String(ex.password) !== '',
      fullSuri: t,
    }
  } catch {
    return null
  }
}
