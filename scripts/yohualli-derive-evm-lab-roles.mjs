#!/usr/bin/env node
/**
 * Imprime direcciones EVM para la **misma** BIP39 que usa la PWA, con dos paths:
 * - m/44'/60'/0'/0/0 — patrón habitual “cuenta 0” (fondos / extensión).
 * - m/44'/60'/10'/0/0 — atestación Yohualli (EIP-712 + misma ruta en `yohualliAttestationEip712.ts`).
 *
 * Uso (no commitear la frase):
 *   YOHUALLI_LAB_MNEMONIC="palabra1 palabra2 ..." node scripts/yohualli-derive-evm-lab-roles.mjs
 * Con passphrase BIP39:
 *   YOHUALLI_LAB_MNEMONIC="…" YOHUALLI_LAB_MNEMONIC_PASSPHRASE="…" node …
 */
import { mnemonicToAccount } from 'viem/accounts'

const FUNDING_PATH = "m/44'/60'/0'/0/0"
const ATTEST_PATH = "m/44'/60'/10'/0/0"

const phrase = process.env.YOHUALLI_LAB_MNEMONIC?.trim()
const passphrase = process.env.YOHUALLI_LAB_MNEMONIC_PASSPHRASE

if (!phrase) {
  console.error(
    'Definí YOHUALLI_LAB_MNEMONIC (12+ palabras BIP39, separadas por espacio) o no se derivará nada.'
  )
  process.exit(1)
}

const opt = (path) => (passphrase ? { path, passphrase } : { path })

const funding = mnemonicToAccount(phrase, opt(FUNDING_PATH))
const attest = mnemonicToAccount(phrase, opt(ATTEST_PATH))

console.log('--- Yohualli: EVM por path (misma mnemónica) ---')
console.log(`${FUNDING_PATH}\t(fondos / típica cuenta 0)\n  ${funding.address}`)
console.log(`${ATTEST_PATH}\t(atestación EIP-712 + circuito)\n  ${attest.address}`)
console.log('---')
if (funding.address.toLowerCase() === attest.address.toLowerCase()) {
  console.warn('Aviso: ambas coinciden (raro con paths distintos). Revisá la frase o el runtime.')
}
