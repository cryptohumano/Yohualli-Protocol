import { Keyring } from '@polkadot/keyring'
import type { KeyringInstance, KeyringPair } from '@polkadot/keyring/types'

/** Tres vistas SS58 habituales desde la misma frase/URI (sin añadir pares al keyring activo). */
export type DualSubstrateSs58 = { sr25519: string; ed25519: string; ecdsa: string }

/** Pares Substrate donde la misma URI permite derivar las vistas sr25519 / ed25519 / ecdsa. */
export function isDualSubstrateEligible(pairType: KeyringPair['type']): boolean {
  return pairType === 'sr25519' || pairType === 'ecdsa' || pairType === 'ed25519'
}

/**
 * Deriva las direcciones SS58 sr25519, ed25519 y ecdsa desde la misma frase/URI, con el prefijo SS58
 * actual del keyring.
 */
export function deriveDualSubstrateSs58ForDisplay(
  mainKeyring: KeyringInstance,
  seed: string
): DualSubstrateSs58 | null {
  try {
    const temp = new Keyring({ ss58Format: 42, type: 'sr25519' })
    const pSr = temp.addFromUri(seed, {}, 'sr25519')
    const srPk = pSr.publicKey
    temp.removePair(pSr.address)
    const pEd = temp.addFromUri(seed, {}, 'ed25519')
    const edPk = pEd.publicKey
    temp.removePair(pEd.address)
    const pEc = temp.addFromUri(seed, {}, 'ecdsa')
    const ecPk = pEc.publicKey
    temp.removePair(pEc.address)

    return {
      sr25519: mainKeyring.encodeAddress(srPk),
      ed25519: mainKeyring.encodeAddress(edPk),
      ecdsa: mainKeyring.encodeAddress(ecPk),
    }
  } catch {
    return null
  }
}
