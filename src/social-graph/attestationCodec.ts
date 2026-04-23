import { stringToU8a, u8aToHex } from '@polkadot/util'
import { signatureVerify } from '@polkadot/util-crypto'
import type { SocialAttestation } from '@/social-graph/types/graph'

const PAYLOAD_VERSION = 1 as const

export function buildAttestationSigningPayloadUtf8(input: {
  subjectAddress: string
  timestampMs: number
  contextId: string
  trustTier: number
}): string {
  return JSON.stringify({
    v: PAYLOAD_VERSION,
    subject: input.subjectAddress,
    ts: input.timestampMs,
    ctx: input.contextId,
    tier: input.trustTier,
  })
}

export function signingPayloadToBytes(utf8: string): Uint8Array {
  return stringToU8a(utf8)
}

export async function computeAttestationId(att: Omit<SocialAttestation, 'id'>): Promise<string> {
  const b = att.eip712V0
  const eipSlice = b
    ? `|EIP712V0|${b.signature}|${b.signerAddress}|${b.subjectCommitment}|${b.chainId}|${b.epoch}|${b.schemaId}`
    : ''
  const raw = stringToU8a(
    `${att.subjectAddress}|${att.attesterAddress}|${att.timestampMs}|${att.contextId}|${att.trustTier}|${att.signatureHex}|${att.signingPayloadUtf8}${eipSlice}`
  )
  const buf = await crypto.subtle.digest('SHA-256', raw)
  return u8aToHex(new Uint8Array(buf))
}

export function verifyAttestationSignature(att: SocialAttestation): boolean {
  try {
    const messageBytes = signingPayloadToBytes(att.signingPayloadUtf8)
    const sigHex = att.signatureHex.startsWith('0x') ? att.signatureHex : `0x${att.signatureHex}`
    const { isValid } = signatureVerify(messageBytes, sigHex, att.attesterAddress)
    return isValid
  } catch {
    return false
  }
}
