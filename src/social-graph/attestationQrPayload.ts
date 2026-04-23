import { decodeAddress } from '@polkadot/util-crypto'
import { z } from 'zod'

/** Identificador fijo del payload embebido en el código QR (solicitud sin firmar). */
export const YOHUALLI_ATTESTATION_QR_KIND = 'yohualli_attestation_request' as const

const attestationQrV1Schema = z.object({
  kind: z.literal(YOHUALLI_ATTESTATION_QR_KIND),
  schemaVersion: z.literal(1),
  subjectAddress: z.string().min(1),
  contextId: z.string(),
  trustTier: z.number().int().min(0),
})

export type AttestationQrV1Payload = z.infer<typeof attestationQrV1Schema>

export function buildAttestationQrString(input: {
  subjectAddress: string
  contextId: string
  trustTier: number
}): string {
  const payload: AttestationQrV1Payload = {
    kind: YOHUALLI_ATTESTATION_QR_KIND,
    schemaVersion: 1,
    subjectAddress: input.subjectAddress.trim(),
    contextId: (input.contextId.trim() || 'default').trim(),
    trustTier: input.trustTier,
  }
  return JSON.stringify(payload)
}

export type ParseAttestationQrResult =
  | { ok: true; data: AttestationQrV1Payload }
  | { ok: false; error: string }

/**
 * Interpreta texto leído de un QR o pegado manualmente.
 * Valida esquema y que `subjectAddress` sea SS58 decodificable.
 */
export function parseAttestationQrString(raw: string): ParseAttestationQrResult {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw.trim())
  } catch {
    return { ok: false, error: 'El contenido no es JSON válido.' }
  }

  const parsed = attestationQrV1Schema.safeParse(parsedJson)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'No coincide con una solicitud de atestación del grafo social (versión 1).',
    }
  }

  try {
    decodeAddress(parsed.data.subjectAddress.trim())
  } catch {
    return { ok: false, error: 'La dirección del sujeto no es una cuenta SS58 válida.' }
  }

  return { ok: true, data: parsed.data }
}
