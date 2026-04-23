import type { SocialAttestation } from '@/social-graph/types/graph'
import { attestationFreshness } from '@/social-graph/graphVisualization'

/**
 * SybilRank off-chain: semillas **implícitas por tier** emitido, opcionalmente fusionadas
 * con **trusted seeds de lab** (`trustedSeedsLab.ts` + env `VITE_LAB_TRUSTED_*`).
 * La masa se teleporta con `dampingAlpha` hacia esa distribución en cada iteración.
 *
 * No es el SybilRank completo del borrador (conductancia, VRF on-chain, etc.).
 */

export type TierSybilRankOptions = {
  nowMs?: number
  /** Primer intento: nodos cuyo máximo tier emitido (como atestador) ≥ este valor. */
  implicitSeedTierMin?: number
  /** Prob. de teleport a la distribución de semillas (0–1). */
  dampingAlpha?: number
  powerIterations?: number
  /** Masa extra repartida entre estos nodos (p. ej. centro del vecindario) antes de renorm. */
  boostSeedNodeIds?: readonly string[]
  boostExtraMass?: number
  /**
   * Representantes trusted por identidad para masa de semillas (p. ej. `resolveTrustedSeedRepresentativesForSybil`).
   */
  trustedSeedNodeIds?: readonly string[]
  /** Todas las caras trusted presentes en el subgrafo (reporte UI); si no se pasa, se usa `trustedSeedNodeIds`. */
  trustedSeedAllGraphHits?: readonly string[]
  /** Fracción de masa de semillas sobre `trustedSeedNodeIds` (0–1); el resto va a semillas por tier. */
  trustedSeedMassFraction?: number
}

export type TierSybilRankResult = {
  /** Puntuación normalizada por el máximo (0..1), útil en UI. */
  scores01: Map<string, number>
  rawScores: Map<string, number>
  /** Semillas implícitas por umbral de tier emitido. */
  seedNodeIds: readonly string[]
  implicitSeedTierThresholdUsed: number
  /** Nodos del subgrafo que coinciden con alguna cara trusted (puede incluir SS58 y EVM). */
  labTrustedSeedNodeIdsHit: readonly string[]
}

const DEFAULT_OPTS = {
  implicitSeedTierMin: 7,
  dampingAlpha: 0.18,
  powerIterations: 48,
  boostExtraMass: 0.12,
  trustedSeedMassFraction: 0.65,
} as const

function collectNodes(attestations: readonly SocialAttestation[]): string[] {
  const s = new Set<string>()
  for (const a of attestations) {
    s.add(a.subjectAddress)
    s.add(a.attesterAddress)
  }
  return [...s]
}

function maxTierEmittedAsAttester(nodeId: string, attestations: readonly SocialAttestation[]): number {
  let m = 0
  for (const a of attestations) {
    if (a.attesterAddress === nodeId && a.trustTier > m) m = a.trustTier
  }
  return m
}

function buildAggregatedEdges(
  attestations: readonly SocialAttestation[],
  nowMs: number
): { outSum: Map<string, number>; outEdges: Map<string, { v: string; w: number }[]> } {
  const pairW = new Map<string, number>()
  for (const a of attestations) {
    const w = attestationFreshness(a, nowMs) * (0.15 + a.trustTier * 0.12)
    const k = `${a.attesterAddress}\t${a.subjectAddress}`
    pairW.set(k, (pairW.get(k) ?? 0) + w)
  }
  const outSum = new Map<string, number>()
  const outEdges = new Map<string, { v: string; w: number }[]>()
  for (const [k, w] of pairW) {
    if (w <= 0) continue
    const [u, v] = k.split('\t')
    outSum.set(u, (outSum.get(u) ?? 0) + w)
    if (!outEdges.has(u)) outEdges.set(u, [])
    outEdges.get(u)!.push({ v, w })
  }
  return { outSum, outEdges }
}

function normalizeMap(m: Map<string, number>, nodes: readonly string[]): void {
  let s = 0
  for (const n of nodes) s += m.get(n) ?? 0
  if (s <= 0) {
    const u = 1 / Math.max(1, nodes.length)
    for (const n of nodes) m.set(n, u)
    return
  }
  for (const n of nodes) m.set(n, (m.get(n) ?? 0) / s)
}

function pickImplicitSeeds(
  nodes: readonly string[],
  attestations: readonly SocialAttestation[],
  implicitSeedTierMin: number
): { seeds: string[]; thresholdUsed: number } {
  const maxTier = new Map<string, number>()
  for (const n of nodes) maxTier.set(n, maxTierEmittedAsAttester(n, attestations))
  let thr = implicitSeedTierMin
  while (thr >= 0) {
    const seeds = nodes.filter((n) => (maxTier.get(n) ?? 0) >= thr)
    if (seeds.length > 0) return { seeds, thresholdUsed: thr }
    thr -= 1
  }
  return { seeds: [...nodes], thresholdUsed: 0 }
}

function buildImplicitTierSeedMass(
  seeds: readonly string[],
  maxTierEmitted: Map<string, number>,
  boostIds: readonly string[] | undefined,
  boostExtra: number,
  allNodes: readonly string[]
): Map<string, number> {
  const mass = new Map<string, number>()
  for (const n of allNodes) mass.set(n, 0)
  let sum = 0
  for (const s of seeds) {
    const w = (maxTierEmitted.get(s) ?? 0) + 1
    mass.set(s, w)
    sum += w
  }
  for (const s of seeds) mass.set(s, (mass.get(s) ?? 0) / sum)

  if (boostIds?.length && boostExtra > 0) {
    const targets = boostIds.filter((id) => allNodes.includes(id))
    if (targets.length > 0) {
      const add = boostExtra / targets.length
      for (const t of targets) mass.set(t, (mass.get(t) ?? 0) + add)
      normalizeMap(mass, allNodes)
    }
  }
  return mass
}

/** Masa de teleport: trusted lab + fracción restante en semillas por tier (excl. trusted en la parte tier). */
function buildCombinedSeedMass(
  allNodes: readonly string[],
  trustedInGraph: readonly string[],
  implicitSeeds: readonly string[],
  maxTierEmitted: Map<string, number>,
  boostIds: readonly string[] | undefined,
  boostExtra: number,
  trustedFraction: number
): Map<string, number> {
  if (trustedInGraph.length === 0) {
    return buildImplicitTierSeedMass(implicitSeeds, maxTierEmitted, boostIds, boostExtra, allNodes)
  }

  const mass = new Map<string, number>()
  for (const n of allNodes) mass.set(n, 0)
  const tf = Math.max(0, Math.min(1, trustedFraction))
  for (const t of trustedInGraph) {
    mass.set(t, (mass.get(t) ?? 0) + tf / trustedInGraph.length)
  }
  const rem = 1 - tf
  if (rem > 0) {
    let tierSeeds = implicitSeeds.filter((s) => !trustedInGraph.includes(s))
    if (tierSeeds.length === 0) tierSeeds = [...allNodes]
    let tw = 0
    for (const s of tierSeeds) tw += (maxTierEmitted.get(s) ?? 0) + 1
    for (const s of tierSeeds) {
      const w = (maxTierEmitted.get(s) ?? 0) + 1
      mass.set(s, (mass.get(s) ?? 0) + (rem * w) / tw)
    }
  }
  normalizeMap(mass, allNodes)

  if (boostIds?.length && boostExtra > 0) {
    const targets = boostIds.filter((id) => allNodes.includes(id))
    if (targets.length > 0) {
      const add = boostExtra / targets.length
      for (const t of targets) mass.set(t, (mass.get(t) ?? 0) + add)
      normalizeMap(mass, allNodes)
    }
  }
  return mass
}

/**
 * Propagación tipo SybilRank/PageRank en el subgrafo dado por `attestations`.
 */
export function computeTierSybilRank(
  attestations: readonly SocialAttestation[],
  options?: TierSybilRankOptions
): TierSybilRankResult {
  const nowMs = options?.nowMs ?? Date.now()
  const implicitSeedTierMin = options?.implicitSeedTierMin ?? DEFAULT_OPTS.implicitSeedTierMin
  const alpha = options?.dampingAlpha ?? DEFAULT_OPTS.dampingAlpha
  const iters = options?.powerIterations ?? DEFAULT_OPTS.powerIterations
  const boostExtra = options?.boostExtraMass ?? DEFAULT_OPTS.boostExtraMass

  const nodes = collectNodes(attestations)
  if (nodes.length === 0) {
    return {
      scores01: new Map(),
      rawScores: new Map(),
      seedNodeIds: [],
      implicitSeedTierThresholdUsed: -1,
      labTrustedSeedNodeIdsHit: [],
    }
  }

  const { outSum, outEdges } = buildAggregatedEdges(attestations, nowMs)
  const maxTierEmitted = new Map<string, number>()
  for (const n of nodes) maxTierEmitted.set(n, maxTierEmittedAsAttester(n, attestations))

  const { seeds, thresholdUsed } = pickImplicitSeeds(nodes, attestations, implicitSeedTierMin)
  const trustedInGraph = (options?.trustedSeedNodeIds ?? []).filter((id) => nodes.includes(id))
  const trustedFrac = options?.trustedSeedMassFraction ?? DEFAULT_OPTS.trustedSeedMassFraction
  const seedMass = buildCombinedSeedMass(
    nodes,
    trustedInGraph,
    seeds,
    maxTierEmitted,
    options?.boostSeedNodeIds,
    boostExtra,
    trustedFrac
  )

  const leakTargets =
    trustedInGraph.length > 0 ? trustedInGraph : seeds.length > 0 ? seeds : nodes

  const r = new Map<string, number>()
  for (const n of nodes) r.set(n, seedMass.get(n) ?? 0)
  normalizeMap(r, nodes)

  const rNew = new Map<string, number>()

  for (let i = 0; i < iters; i++) {
    for (const n of nodes) rNew.set(n, 0)
    for (const n of nodes) {
      rNew.set(n, (rNew.get(n) ?? 0) + alpha * (seedMass.get(n) ?? 0))
    }

    for (const u of nodes) {
      const out = outSum.get(u) ?? 0
      const ru = r.get(u) ?? 0
      if (out > 0) {
        for (const { v, w } of outEdges.get(u) ?? []) {
          rNew.set(v, (rNew.get(v) ?? 0) + (1 - alpha) * ru * (w / out))
        }
      } else if (ru > 0 && leakTargets.length > 0) {
        const leak = (1 - alpha) * ru
        for (const s of leakTargets) {
          rNew.set(s, (rNew.get(s) ?? 0) + leak / leakTargets.length)
        }
      }
    }

    for (const n of nodes) r.set(n, rNew.get(n) ?? 0)
    normalizeMap(r, nodes)
  }

  let mx = 0
  for (const n of nodes) mx = Math.max(mx, r.get(n) ?? 0)
  const scores01 = new Map<string, number>()
  if (mx <= 0) {
    const u = 1 / nodes.length
    for (const n of nodes) scores01.set(n, u)
  } else {
    for (const n of nodes) scores01.set(n, (r.get(n) ?? 0) / mx)
  }

  return {
    scores01,
    rawScores: new Map(r),
    seedNodeIds: seeds,
    implicitSeedTierThresholdUsed: thresholdUsed,
    labTrustedSeedNodeIdsHit: options?.trustedSeedAllGraphHits ?? trustedInGraph,
  }
}
