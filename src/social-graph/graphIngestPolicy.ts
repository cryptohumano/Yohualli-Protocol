import type { SocialAttestation } from '@/social-graph/types/graph'

/**
 * Política de ingesta off-chain (lab), inspirada en Yohualli Protocol draft 1.1:
 * - §4.3 ventanas imposibles para interacción humana (<500ms)
 * - límites de tasa / spam por par y por sujeto
 * - mitigación leve de colusión A↔B (muchas aristas mutuas en poco tiempo)
 *
 * No sustituye SybilRank, conductancia ni VRF on-chain; prepara el grafo para
 * scores y circuitos posteriores.
 */

export type GraphIngestPolicy = {
  /** Rechazar sujeto === atestador. */
  rejectSelfAttestation: boolean
  /** Entre dos atestaciones consecutivas atestador→mismo sujeto (cualquier contexto). */
  minMsBetweenAttesterToSameSubject: number
  /** Mismo par (atestador, sujeto, contextId): evita spam de firmas idénticas en contexto. */
  minMsRepeatAttesterSubjectContext: number
  /** Máximo de aristas dirigidas atestador→sujeto en la ventana de 60s (excluye la actual). */
  maxDirectedAttesterToSubjectPerMinute: number
  /** Máximo de aristas en ambas direcciones entre el par en 1h (anti colusión cíclica). */
  maxUndirectedPairAttestationsPerHour: number
  /** Máximo de atestaciones que recibe un sujeto (de cualquiera) en 60s — anti “bombardeo”. */
  maxInboundToSubjectPerMinute: number
  trustTierMin: number
  trustTierMax: number
}

export const DEFAULT_GRAPH_INGEST_POLICY: GraphIngestPolicy = {
  rejectSelfAttestation: true,
  minMsBetweenAttesterToSameSubject: 500,
  minMsRepeatAttesterSubjectContext: 30_000,
  maxDirectedAttesterToSubjectPerMinute: 8,
  maxUndirectedPairAttestationsPerHour: 48,
  maxInboundToSubjectPerMinute: 40,
  trustTierMin: 0,
  trustTierMax: 10,
}

export type GraphIngestStats = {
  latestFromAttesterToSubject?: SocialAttestation
  directedAttesterToSubjectLastMinute: number
  undirectedPairLastHour: number
  inboundToSubjectLastMinute: number
}

export type GraphIngestPolicyResult = { ok: true } | { ok: false; reason: string }

export function evaluateGraphIngestPolicy(
  att: SocialAttestation,
  stats: GraphIngestStats,
  policy: GraphIngestPolicy = DEFAULT_GRAPH_INGEST_POLICY
): GraphIngestPolicyResult {
  if (policy.rejectSelfAttestation && att.subjectAddress === att.attesterAddress) {
    return { ok: false, reason: 'Auto-atestación no permitida (anti-colusión trivial)' }
  }
  if (
    !Number.isFinite(att.trustTier) ||
    att.trustTier < policy.trustTierMin ||
    att.trustTier > policy.trustTierMax
  ) {
    return {
      ok: false,
      reason: `Trust tier fuera de rango permitido (${policy.trustTierMin}–${policy.trustTierMax})`,
    }
  }

  const prev = stats.latestFromAttesterToSubject
  if (prev) {
    const dt = att.timestampMs - prev.timestampMs
    if (dt < policy.minMsBetweenAttesterToSameSubject) {
      return {
        ok: false,
        reason: `Ráfaga anti-bot: mismo atestador→sujeto en <${policy.minMsBetweenAttesterToSameSubject}ms (borrador §4.3)`,
      }
    }
    if (
      prev.contextId === att.contextId &&
      dt < policy.minMsRepeatAttesterSubjectContext
    ) {
      return {
        ok: false,
        reason: `Anti-spam: mismo contexto y par atestador–sujeto en <${Math.round(policy.minMsRepeatAttesterSubjectContext / 1000)}s`,
      }
    }
  }

  if (stats.directedAttesterToSubjectLastMinute >= policy.maxDirectedAttesterToSubjectPerMinute) {
    return {
      ok: false,
      reason: `Límite por minuto: demasiadas atestaciones atestador→este sujeto (${policy.maxDirectedAttesterToSubjectPerMinute}/min)`,
    }
  }

  if (stats.undirectedPairLastHour >= policy.maxUndirectedPairAttestationsPerHour) {
    return {
      ok: false,
      reason: `Anti-colusión: demasiadas atestaciones mutuas entre este par en 1h (${policy.maxUndirectedPairAttestationsPerHour})`,
    }
  }

  if (stats.inboundToSubjectLastMinute >= policy.maxInboundToSubjectPerMinute) {
    return {
      ok: false,
      reason: `Anti-spam al sujeto: demasiadas atestaciones entrantes en 1 min (${policy.maxInboundToSubjectPerMinute})`,
    }
  }

  return { ok: true }
}
