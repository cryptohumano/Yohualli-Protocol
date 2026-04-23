import type { GraphVizData, GraphVizLink, GraphVizNode, NeighborhoodView, SocialAttestation } from '@/social-graph/types/graph'
import type { TierSybilRankResult } from '@/social-graph/sybilRankTiers'

const FRESH_HALF_LIFE_DAYS = 180

/** Frescura tipo Yohualli (atestación reciente pesa más). */
export function attestationFreshness(att: SocialAttestation, nowMs = Date.now()): number {
  const ageDays = (nowMs - att.timestampMs) / (86_400 * 1000)
  return Math.max(0, 1 - ageDays / FRESH_HALF_LIFE_DAYS)
}

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

/** Distancia en saltos desde `centerId` sobre el grafo no dirigido de atestaciones. */
export function hopDistancesFromCenter(centerId: string, attestations: SocialAttestation[]): Map<string, number> {
  const adj = new Map<string, Set<string>>()
  const addEdge = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  for (const e of attestations) {
    addEdge(e.subjectAddress, e.attesterAddress)
  }
  const dist = new Map<string, number>()
  const q: string[] = []
  if (adj.has(centerId)) {
    dist.set(centerId, 0)
    q.push(centerId)
  }
  while (q.length) {
    const u = q.shift()!
    const du = dist.get(u)!
    for (const v of adj.get(u) ?? []) {
      if (!dist.has(v)) {
        dist.set(v, du + 1)
        q.push(v)
      }
    }
  }
  return dist
}

/**
 * Construye datos para force-graph a partir de un vecindario ya calculado.
 * Peso de arista (visual): frescura × factor por trust tier (lab, no SybilRank completo).
 * Si pasás `tierSybil`, se adjunta `sybilRank01` por nodo y se refuerza `val` para el layout.
 */
export function buildGraphVizData(
  view: NeighborhoodView,
  nowMs = Date.now(),
  tierSybil?: Pick<TierSybilRankResult, 'scores01'>
): GraphVizData {
  const { centerNodeId, attestations } = view
  const hops = hopDistancesFromCenter(centerNodeId, attestations)

  const degree = new Map<string, number>()
  for (const e of attestations) {
    degree.set(e.subjectAddress, (degree.get(e.subjectAddress) ?? 0) + 1)
    degree.set(e.attesterAddress, (degree.get(e.attesterAddress) ?? 0) + 1)
  }

  const nodeIds = new Set<string>()
  for (const e of attestations) {
    nodeIds.add(e.subjectAddress)
    nodeIds.add(e.attesterAddress)
  }
  if (!nodeIds.has(centerNodeId)) nodeIds.add(centerNodeId)

  const nodes: GraphVizNode[] = [...nodeIds].map((id) => {
    const d = hops.get(id) ?? 999
    const deg = degree.get(id) ?? 0
    const sr = tierSybil?.scores01.get(id)
    const sybilRank01 = sr !== undefined ? sr : undefined
    const val =
      2 +
      deg * 1.5 +
      (id === centerNodeId ? 3 : 0) +
      (sybilRank01 !== undefined ? sybilRank01 * 5 : 0)
    return {
      id,
      label: shortAddr(id),
      hopFromCenter: d === 999 ? -1 : d,
      degree: deg,
      isCenter: id === centerNodeId,
      val,
      sybilRank01,
    }
  })

  const links: GraphVizLink[] = attestations.map((e) => {
    const fresh = attestationFreshness(e, nowMs)
    const ha = hops.get(e.attesterAddress) ?? 999
    const hs = hops.get(e.subjectAddress) ?? 999
    const minHop = Math.min(ha, hs)
    const weight = fresh * (0.35 + e.trustTier * 0.12)
    return {
      source: e.attesterAddress,
      target: e.subjectAddress,
      weight,
      freshness: fresh,
      trustTier: e.trustTier,
      attestationId: e.id,
      minHopFromCenter: minHop === 999 ? -1 : minHop,
    }
  })

  return { nodes, links }
}
