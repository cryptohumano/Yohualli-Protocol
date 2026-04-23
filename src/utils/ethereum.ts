/**
 * Dirección EVM (0x) alineada con carteras típicas (BIP39 + BIP44 m/44'/60'/0'/0/0)
 * y con URIs de tipo Ethereum de Polkadot.js cuando no aplica frase estándar.
 */

import { Keyring } from '@polkadot/keyring'
import { keyExtractSuri } from '@polkadot/util-crypto'
import { mnemonicToAccount } from 'viem/accounts'
import { toHex, type Hex } from 'viem'
import type { KeyringPair } from '@polkadot/keyring/types'

const BIP39_LENGTHS = new Set([12, 15, 18, 21, 24])

/**
 * Dirección 0x cuenta 0 (m/44'/60'/0'/0/0), misma convención que MetaMask / viem.
 * Acepta SURI de Polkadot (frase + rutas ///contraseña).
 */
export function deriveBip44EthereumAddressFromSuri(suriOrMnemonic: string): string | null {
  const trimmed = suriOrMnemonic.trim()
  if (!trimmed) return null
  try {
    const { phrase, password } = keyExtractSuri(trimmed)
    const words = phrase.normalize('NFC').split(/\s+/).filter(Boolean)
    if (!BIP39_LENGTHS.has(words.length)) return null
    const acc = password
      ? mnemonicToAccount(phrase, { passphrase: password })
      : mnemonicToAccount(phrase)
    return acc.address
  } catch {
    return null
  }
}

/**
 * Deriva una dirección EVM (0x) desde seed / mnemonic / SURI.
 * Prioriza BIP44 (MetaMask); si no es una frase BIP39 reconocible, usa el keyring Ethereum de Polkadot.
 */
export function deriveEthereumAddress(seed: string): string {
  const bip44 = deriveBip44EthereumAddressFromSuri(seed)
  if (bip44) return bip44
  try {
    const keyring = new Keyring({ type: 'ethereum', ss58Format: 42 })
    const pair = keyring.addFromUri(seed.trim())
    const addr = pair.address
    return addr.startsWith('0x') ? addr : `0x${addr}`
  } catch (error) {
    console.error('Error al derivar dirección Ethereum:', error)
    throw new Error(`No se pudo derivar la dirección Ethereum: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Dirección EVM (0x) coherente con BIP44 cuando conocemos la SURI; si el par ya es `ethereum`, usa su 0x.
 * No usa el hash keccak de la pubkey Substrate ECDSA (eso no coincide con MetaMask).
 */
export function deriveEthereumAddressFromPair(pair: KeyringPair, seed?: string): string | null {
  try {
    if (pair.type === 'ethereum') {
      const addr = pair.address
      return addr.startsWith('0x') ? addr : `0x${addr}`
    }
    if (seed) {
      const bip44 = deriveBip44EthereumAddressFromSuri(seed)
      if (bip44) return bip44
      return deriveEthereumAddress(seed)
    }
    return null
  } catch (error) {
    console.error('Error al derivar dirección Ethereum desde pair:', error)
    return null
  }
}

const SECP_32_HEX = /^(0x)?[0-9a-fA-F]{64}$/

/**
 * Clave privada secp256k1 en hex `0x` + 64 carácteres, misma derivación BIP44 que
 * {@link deriveBip44EthereumAddressFromSuri} (MetaMask, **m/44'/60'/0'/0/0**).
 * Sirve para `PRIVATE_KEY` de Hardhat / `cast send` en Polkadot Hub PVM-EVM.
 *
 * - Frase BIP39 + SURI: usa solo la frase (y `///` password si aplica), **no** las
 *   rutas Substrate (`//yohualli`, etc.).
 * - `0x` + 32 bytes: devuelve la misma clave normalizada a `0x` minúscula.
 * - JSON Polkadot o cuentas sin material BIP39: devuelve `null`.
 */
export function evmBip44PrivateKey0xFromSuri(suriOrKey: string): Hex | null {
  const t = suriOrKey.trim()
  if (!t) return null
  if (SECP_32_HEX.test(t)) {
    const h = t.startsWith('0x') || t.startsWith('0X') ? t.slice(2) : t
    return `0x${h.toLowerCase()}` as Hex
  }
  try {
    const { phrase, password } = keyExtractSuri(t)
    const words = phrase.normalize('NFC').split(/\s+/).filter(Boolean)
    if (!BIP39_LENGTHS.has(words.length)) return null
    const acc = password
      ? mnemonicToAccount(phrase, { passphrase: password })
      : mnemonicToAccount(phrase)
    const key = acc.getHdKey().privateKey
    if (key == null) return null
    return toHex(key)
  } catch {
    return null
  }
}

/**
 * Verifica si una dirección Ethereum es válida
 * @param address - La dirección a verificar
 * @returns true si es válida
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!address || !address.startsWith('0x')) return false
  if (address.length !== 42) return false // 0x + 40 caracteres hex
  
  // Verificar que todos los caracteres después de 0x sean hexadecimales
  const hexPart = address.slice(2)
  return /^[0-9a-fA-F]{40}$/.test(hexPart)
}

