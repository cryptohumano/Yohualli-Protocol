import type { KeyringPair } from '@polkadot/keyring/types'

export function getKeypairType(pair: Pick<KeyringPair, 'type'> | undefined): string {
  return pair?.type ?? 'desconocido'
}

/** Cuentas secp256k1 usadas en Yohualli / Polkadot (Substrate ECDSA o par Ethereum del keyring). */
export function isSecp256k1Family(type: string): boolean {
  return type === 'ecdsa' || type === 'ethereum'
}

export function keypairTypeBadgeVariant(
  type: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (type === 'ecdsa' || type === 'ethereum') return 'default'
  if (type === 'ed25519') return 'secondary'
  return 'outline'
}
