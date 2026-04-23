import { decodeAddress } from '@polkadot/util-crypto'
import { hexToBytes, type Hex } from 'viem'
import type { InputMap } from '@noir-lang/types'

import { buildSubjectCommitmentV0FromSs58 } from '@/utils/yohualliAttestationEip712'
import { LAB_TRUSTED_SEED_IDENTITIES } from '@/social-graph/trustedSeedsLab'

const u8 = (b: Uint8Array) => Array.from(b)

/**
 * Mismo criterio v0: `keccak256(0x01 || decodeAddress(ss58))` con pk de 32 B.
 * Defecto: `VITE_YOHUALLI_LAB_SUBJECT_SS58`, o el primer `substrate` de lab
 * en `LAB_TRUSTED_SEED_IDENTITIES` (o SS58 fijo de ejemplo).
 */
export const DEFAULT_LAB_SUBJECT_SS58: string =
  LAB_TRUSTED_SEED_IDENTITIES.find((r) => r.substrate)?.substrate ??
  '5FnBJLXEjEYiGeTgKaxapS2m8WpsTUGp1sj2ZbwMhodQUo9t'

export function getYohualliSubjectCommitmentV0LabInputMap(opts?: { subjectSs58?: string }): {
  inputMap: InputMap
  subjectSs58: string
  subjectCommitment: Hex
  pk: Uint8Array
} {
  const subjectSs58 = (
    opts?.subjectSs58?.trim() ??
    (import.meta.env.VITE_YOHUALLI_LAB_SUBJECT_SS58 as string | undefined)?.trim() ??
    DEFAULT_LAB_SUBJECT_SS58
  ).trim()

  const pk = decodeAddress(subjectSs58)
  if (pk.length !== 32) {
    throw new Error(
      `decodeAddress longitud ${pk.length}; este circuito fija pk a 32 B (cuentas Substrate comunes).`,
    )
  }

  const scHex = buildSubjectCommitmentV0FromSs58(subjectSs58) as Hex
  const scBytes = hexToBytes(scHex)
  const inputMap = {
    pk: u8(pk),
    subject_commitment: u8(scBytes),
  } satisfies InputMap

  return {
    inputMap: inputMap as InputMap,
    subjectSs58,
    subjectCommitment: scHex,
    pk,
  }
}
