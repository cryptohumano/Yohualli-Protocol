import { keyExtractSuri } from '@polkadot/util-crypto'

/**
 * Identidad Substrate en Yohualli: derivación fija bajo ruta dura
 * [Polkadot SURI `//yohualli`](https://wiki.polkadot.network/docs/learn-accounts#derivation-paths) para transmisión y mapeo al grafo.
 * La clave de atestación (Sr25519) y la metadata de relay deben usar el mismo criterio; la EVM para EIP-712 sigue en
 * `m/44'/60'/10'/0/0` desde la misma frase.
 */
export const YOHUALLI_SUBSTRATE_DERIVATION = '//yohualli' as const

const BIP39_LENGTHS = new Set([12, 15, 18, 21, 24])

/**
 * `derivePath` incluye un segmento duro o blando `yohualli` (p. ej. `//yohualli` o `//foo//yohualli`).
 */
export function hasYohualliSubstrateDerivationInSuri(suri: string): boolean {
  const t = suri.trim()
  if (!t) return false
  if (t.includes('//yohualli') || t.includes('//YOHUALLI')) return true
  try {
    const { derivePath } = keyExtractSuri(suri.normalize('NFC'))
    if (!derivePath) return false
    if (derivePath.toLowerCase().includes('yohualli')) return true
    for (const seg of derivePath.split('//').filter(Boolean)) {
      for (const part of seg.split('/').filter(Boolean)) {
        if (part.toLowerCase() === 'yohualli') return true
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Cuenta dev tipo `//Alice` o seed hex: no tocar. Frase BIP39 u otra SURI: añade `//yohualli` si aún no está
 * (respeta `///` contraseña y rutas existentes). Palabra suelta no BIP39 (p. ej. claves de dev) sin ruta: se deja igual.
 */
export function ensureYohualliSubstrateSuri(suri: string): string {
  const t = suri.trim().normalize('NFC')
  if (!t) return t
  if (hasYohualliSubstrateDerivationInSuri(t)) return t
  if (t.startsWith('0x') && t.length > 2) return t
  if (/^\/\/[^/]+$/u.test(t) && !/\s/.test(t)) return t

  try {
    const ex = keyExtractSuri(t)
    const w = ex.phrase.split(/\s+/).filter(Boolean)
    const isBip39 = BIP39_LENGTHS.has(w.length)
    if (!isBip39 && !ex.derivePath) return t
    if (isBip39 && !ex.derivePath) {
      const pathPart = YOHUALLI_SUBSTRATE_DERIVATION
      return ex.password != null && String(ex.password) !== ''
        ? `${ex.phrase}${pathPart}///${ex.password}`
        : `${ex.phrase}${pathPart}`
    }
    const pathPart = (ex.derivePath || '') + YOHUALLI_SUBSTRATE_DERIVATION
    return ex.password != null && String(ex.password) !== ''
      ? `${ex.phrase}${pathPart}///${ex.password}`
      : `${ex.phrase}${pathPart}`
  } catch {
    return t
  }
}
