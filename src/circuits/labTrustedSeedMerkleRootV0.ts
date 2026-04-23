import { LAB_TRUSTED_SEED_IDENTITIES } from '@/social-graph/trustedSeedsLab'
import { buildSubjectCommitmentV0FromSs58 } from '@/utils/yohualliAttestationEip712'
import type { Hex } from 'viem'

/** Alineado con el fallback de `yohualliSubjectCommitmentV0ProverLabInputs`. */
const FALLBACK_LAB_SS58 = '5FnBJLXEjEYiGeTgKaxapS2m8WpsTUGp1sj2ZbwMhodQUo9t'

/**
 * SS58 de lab: primera fila con `substrate` en `LAB_TRUSTED_SEED_IDENTITIES` o fallback fijo.
 */
export const LAB_TRUSTED_SEED_DEFAULT_SS58: string =
  LAB_TRUSTED_SEED_IDENTITIES.find((r) => r.substrate)?.substrate ?? FALLBACK_LAB_SS58

/**
 * `merkle_root` de lab alineado con hoja única = `subjectCommitment` v0 (árbol 1 hoja: root = hoja).
 * Mismo bytes32 que `setMerkleRoot(epoch, …)` en `YohualliMerkleHonkRegistry` para cerrar
 * el loop con `yohualli_merkle_attest_v1` (merkle en públicos) y
 * `npm run merkle:root:trusted-seed-leaves` (un solo seed).
 */
export const LAB_TRUSTED_SEED_MERKLE_ROOT_SINGLE_LEAF: Hex = buildSubjectCommitmentV0FromSs58(
  LAB_TRUSTED_SEED_DEFAULT_SS58,
) as Hex
