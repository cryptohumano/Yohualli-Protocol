/**
 * Atestación Yohualli v0 — digest EIP-712 alineado con docs/YOHUALLI_ATTESTATION_SIGNING_V0.md.
 * Firma local con viem (`mnemonicToAccount` + `signTypedData`), sin `window.ethereum`.
 */

import { decodeAddress, keyExtractSuri } from '@polkadot/util-crypto'
import type { Address, Hex } from 'viem'
import { concat, keccak256, recoverTypedDataAddress, toBytes, toHex, verifyTypedData, zeroAddress } from 'viem'
import type { SocialAttestation, YohualliEip712V0Bundle } from '@/social-graph/types/graph'
import type { LocalAccount } from 'viem/accounts'
import { mnemonicToAccount } from 'viem/accounts'

import { paseoPassetHub } from '@/config/paseoEvm'

export const YOHUALLI_ATTESTATION_BIP44_PATH = "m/44'/60'/10'/0/0" as const

const BIP39_WORD_COUNTS = new Set([12, 15, 18, 21, 24])

/** `keccak256` sobre UTF-8 del literal del doc v0. */
export const YOHUALLI_ATTESTATION_V0_SCHEMA_ID: Hex = keccak256(
  toBytes('YohualliAttestationV0.string+uint64+bytes32+uint8/1')
)

export const yohualliAttestationV0Types = {
  YohualliAttestationV0: [
    { name: 'contextId', type: 'string' },
    { name: 'epoch', type: 'uint64' },
    { name: 'subjectCommitment', type: 'bytes32' },
    { name: 'thresholdBucket', type: 'uint8' },
    { name: 'schemaId', type: 'bytes32' },
  ],
} as const

/** v0 lab: dominio con `verifyingContract = 0x0…0` y `chainId` del hub Paseo (o override). */
export function yohualliAttestationV0Domain(overrides?: {
  chainId?: bigint
  verifyingContract?: Address
}) {
  return {
    name: 'Yohualli' as const,
    version: '1' as const,
    chainId: overrides?.chainId ?? BigInt(paseoPassetHub.id),
    verifyingContract: overrides?.verifyingContract ?? zeroAddress,
  }
}

/**
 * `subjectCommitment = keccak256(abi.encodePacked(uint8 kind, bytes pk))` con `kind = 1` (SS58 → bytes de `decodeAddress`).
 */
export function buildSubjectCommitmentV0FromSs58(subjectSs58: string): Hex {
  const pk = decodeAddress(subjectSs58.trim())
  return keccak256(concat(['0x01', toHex(pk)]))
}

export function getYohualliAttestationSignerFromHdSuri(suri: string): LocalAccount | null {
  const trimmed = suri.trim()
  if (!trimmed) return null
  try {
    const { phrase, password } = keyExtractSuri(trimmed)
    const words = phrase.normalize('NFC').split(/\s+/).filter(Boolean)
    if (!BIP39_WORD_COUNTS.has(words.length)) return null
    return password
      ? mnemonicToAccount(phrase, { path: YOHUALLI_ATTESTATION_BIP44_PATH, passphrase: password })
      : mnemonicToAccount(phrase, { path: YOHUALLI_ATTESTATION_BIP44_PATH })
  } catch {
    return null
  }
}

export type YohualliAttestationV0MessageInput = {
  contextId: string
  epoch: bigint
  subjectSs58: string
  thresholdBucket: number
}

export async function signYohualliAttestationV0FromHdSuri(
  hdDerivationSuri: string,
  input: YohualliAttestationV0MessageInput,
  domainOverrides?: { chainId?: bigint; verifyingContract?: Address }
) {
  if (input.thresholdBucket < 0 || input.thresholdBucket > 255 || !Number.isInteger(input.thresholdBucket)) {
    throw new Error('thresholdBucket debe ser entero 0–255.')
  }
  const signer = getYohualliAttestationSignerFromHdSuri(hdDerivationSuri)
  if (!signer) {
    throw new Error(
      'No se pudo derivar la clave EVM de atestación (BIP44 m/44\'/60\'/10\'/0/0): hace falta frase BIP39 o SURI reconocible por la cuenta.'
    )
  }
  const subjectCommitment = buildSubjectCommitmentV0FromSs58(input.subjectSs58)
  const domain = yohualliAttestationV0Domain(domainOverrides)
  const message = {
    contextId: input.contextId,
    epoch: input.epoch,
    subjectCommitment,
    thresholdBucket: input.thresholdBucket,
    schemaId: YOHUALLI_ATTESTATION_V0_SCHEMA_ID,
  }
  const signature = await signer.signTypedData({
    domain,
    types: yohualliAttestationV0Types,
    primaryType: 'YohualliAttestationV0',
    message,
  })
  const recovered = await recoverTypedDataAddress({
    domain,
    types: yohualliAttestationV0Types,
    primaryType: 'YohualliAttestationV0',
    message,
    signature,
  })
  if (recovered.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error('La dirección recuperada del digest EIP-712 no coincide con la derivada.')
  }
  return {
    signature,
    signerAddress: signer.address as Address,
    subjectCommitment,
    domain,
    message,
  }
}

export function toYohualliEip712V0Bundle(
  signResult: {
    signature: `0x${string}`
    signerAddress: Address
    subjectCommitment: Hex
  },
  options: { chainId: number; epoch: bigint }
): YohualliEip712V0Bundle {
  return {
    signature: signResult.signature,
    signerAddress: signResult.signerAddress,
    subjectCommitment: signResult.subjectCommitment,
    chainId: options.chainId,
    epoch: options.epoch.toString(),
    schemaId: YOHUALLI_ATTESTATION_V0_SCHEMA_ID,
  }
}

/**
 * Comprueba coherencia del ancla EIP-712 con la atestación Substrate (mismo sujeto, contexto, tier) y `verifyTypedData`.
 */
export async function verifyEip712V0AgainstAttestation(
  att: SocialAttestation
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const b = att.eip712V0
  if (!b) return { ok: true }
  if (b.schemaId.toLowerCase() !== YOHUALLI_ATTESTATION_V0_SCHEMA_ID.toLowerCase()) {
    return { ok: false, reason: 'EIP-712: schemaId no coincide con v0' }
  }
  const expectedSc = buildSubjectCommitmentV0FromSs58(att.subjectAddress)
  if (expectedSc.toLowerCase() !== b.subjectCommitment.toLowerCase()) {
    return { ok: false, reason: 'EIP-712: subjectCommitment no coincide con el sujeto SS58' }
  }
  if (att.trustTier < 0 || att.trustTier > 255 || !Number.isInteger(att.trustTier)) {
    return { ok: false, reason: 'trustTier inválido para thresholdBucket' }
  }
  let epoch: bigint
  try {
    epoch = BigInt(b.epoch)
  } catch {
    return { ok: false, reason: 'EIP-712: epoch no es uint64' }
  }
  if (epoch < 0n || epoch > 18446744073709551615n) {
    return { ok: false, reason: 'EIP-712: epoch fuera de rango uint64' }
  }
  if (!Number.isSafeInteger(b.chainId) || b.chainId < 1) {
    return { ok: false, reason: 'EIP-712: chainId inválido' }
  }
  const domain = yohualliAttestationV0Domain({ chainId: BigInt(b.chainId) })
  const message = {
    contextId: att.contextId,
    epoch,
    subjectCommitment: b.subjectCommitment,
    thresholdBucket: att.trustTier,
    schemaId: b.schemaId,
  }
  const valid = await verifyTypedData({
    address: b.signerAddress,
    domain,
    types: yohualliAttestationV0Types,
    primaryType: 'YohualliAttestationV0',
    message,
    signature: b.signature,
  })
  if (!valid) return { ok: false, reason: 'EIP-712: verifyTypedData falló' }
  return { ok: true }
}
