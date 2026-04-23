import type { GraphStats, NeighborhoodView, SocialAttestation } from '@/social-graph/types/graph'
import {
  buildAttestationSigningPayloadUtf8,
  computeAttestationId,
  signingPayloadToBytes,
  verifyAttestationSignature,
} from '@/social-graph/attestationCodec'
import type { YohualliGraphRepository } from '@/social-graph/graphRepository'
import {
  DEFAULT_GRAPH_INGEST_POLICY,
  evaluateGraphIngestPolicy,
  type GraphIngestPolicy,
} from '@/social-graph/graphIngestPolicy'
import { computeTierSybilRank, type TierSybilRankOptions, type TierSybilRankResult } from '@/social-graph/sybilRankTiers'
import {
  getMergedTrustedSeedIdentities,
  resolveTrustedSeedRepresentativesForSybil,
  resolveTrustedSeedsInNodeSet,
  trustedIdentitiesToFlatConfig,
} from '@/social-graph/trustedSeedsLab'
import type { KeyringPair } from '@polkadot/keyring/types'
import { u8aToHex } from '@polkadot/util'
import { verifyEip712V0AgainstAttestation } from '@/utils/yohualliAttestationEip712'

export class SocialGraphService {
  constructor(
    private readonly repo: YohualliGraphRepository,
    private readonly ingestPolicy: GraphIngestPolicy = DEFAULT_GRAPH_INGEST_POLICY
  ) {}

  /**
   * Ingresa una atestación firmada al grafo local tras validar firma, deduplicación y políticas
   * anti-spam / anti-ráfaga / anti-colusión trivial (borrador Yohualli §4.3, lab).
   */
  async ingestAttestation(
    att: SocialAttestation,
    requireValidSignature = true,
    options?: { bypassGraphPolicy?: boolean }
  ): Promise<{ ok: boolean; reason?: string }> {
    if (requireValidSignature && !verifyAttestationSignature(att)) {
      return { ok: false, reason: 'Firma inválida o no coincide con el atestador' }
    }
    if (requireValidSignature && att.eip712V0) {
      const ev = await verifyEip712V0AgainstAttestation(att)
      if (!ev.ok) {
        return { ok: false, reason: ev.reason }
      }
    }
    const existing = await this.repo.getAttestation(att.id)
    if (existing) return { ok: true, reason: 'Deduplicada' }

    if (!options?.bypassGraphPolicy) {
      const minuteStart = att.timestampMs - 60_000
      const hourStart = att.timestampMs - 3_600_000
      const [latestFromAttesterToSubject, directedLastMinute, inboundToSubjectLastMinute, abHour, baHour] =
        await Promise.all([
          this.repo.findLatestAttestationAttesterToSubject(att.attesterAddress, att.subjectAddress),
          this.repo.countDirectedAttestationsInRange(
            att.attesterAddress,
            att.subjectAddress,
            minuteStart,
            att.timestampMs
          ),
          this.repo.countInboundToSubjectInRange(att.subjectAddress, minuteStart, att.timestampMs),
          this.repo.countDirectedAttestationsInRange(
            att.attesterAddress,
            att.subjectAddress,
            hourStart,
            att.timestampMs
          ),
          this.repo.countDirectedAttestationsInRange(
            att.subjectAddress,
            att.attesterAddress,
            hourStart,
            att.timestampMs
          ),
        ])
      const undirectedPairLastHour = abHour + baHour
      const pol = evaluateGraphIngestPolicy(
        att,
        {
          latestFromAttesterToSubject,
          directedAttesterToSubjectLastMinute: directedLastMinute,
          undirectedPairLastHour,
          inboundToSubjectLastMinute: inboundToSubjectLastMinute,
        },
        this.ingestPolicy
      )
      if (!pol.ok) return { ok: false, reason: pol.reason }
    }

    await this.repo.putAttestation(att)
    return { ok: true }
  }

  async buildAndSignAttestation(input: {
    pair: KeyringPair
    subjectAddress: string
    contextId: string
    trustTier: number
    /** Gossip/IndexedDB: misma fila que la firma Substrate. */
    eip712V0?: SocialAttestation['eip712V0']
  }): Promise<SocialAttestation> {
    const timestampMs = Date.now()
    const attesterAddress = input.pair.address
    const signingPayloadUtf8 = buildAttestationSigningPayloadUtf8({
      subjectAddress: input.subjectAddress,
      timestampMs,
      contextId: input.contextId,
      trustTier: input.trustTier,
    })
    const messageBytes = signingPayloadToBytes(signingPayloadUtf8)
    const signatureHex = u8aToHex(input.pair.sign(messageBytes))
    const base: Omit<SocialAttestation, 'id'> = {
      subjectAddress: input.subjectAddress,
      attesterAddress,
      contextId: input.contextId,
      trustTier: input.trustTier,
      timestampMs,
      signatureHex,
      signingPayloadUtf8,
      ...(input.eip712V0 ? { eip712V0: input.eip712V0 } : {}),
    }
    const id = await computeAttestationId(base)
    return { ...base, id }
  }

  async getStats(): Promise<GraphStats> {
    const [nodeCount, attestationCount] = await Promise.all([
      this.repo.countNodes(),
      this.repo.countAttestations(),
    ])
    return { nodeCount, attestationCount }
  }

  /** Historial completo de atestaciones almacenadas (más recientes primero). */
  async listAttestationHistory(): Promise<SocialAttestation[]> {
    return this.repo.listAllAttestationsOrdered(true)
  }

  async setLocalNodeHint(nodeId: string): Promise<void> {
    await this.repo.markLocalNode(nodeId, true)
  }

  /**
   * Vecindario no dirigido: nodos alcanzables en hasta `maxDepth` saltos
   * (cada atestación conecta sujeto ↔ atestador).
   */
  async getNeighborhood(centerNodeId: string, maxDepth: number): Promise<NeighborhoodView> {
    const visited = new Set<string>([centerNodeId])
    let frontier = new Set<string>([centerNodeId])
    const allAttestations: SocialAttestation[] = []
    const edgeSeen = new Set<string>()

    for (let d = 0; d < maxDepth; d++) {
      const nextFrontier = new Set<string>()
      for (const nid of frontier) {
        const edges = await this.repo.getAttestationsTouchingNode(nid)
        for (const e of edges) {
          if (!edgeSeen.has(e.id)) {
            edgeSeen.add(e.id)
            allAttestations.push(e)
          }
          const other = e.subjectAddress === nid ? e.attesterAddress : e.subjectAddress
          if (!visited.has(other)) {
            visited.add(other)
            nextFrontier.add(other)
          }
        }
      }
      frontier = nextFrontier
      if (frontier.size === 0) break
    }

    return {
      depth: maxDepth,
      centerNodeId,
      nodeIds: [...visited],
      attestations: allAttestations,
    }
  }

  async clearAll(): Promise<void> {
    await this.repo.clearAll()
  }

  /**
   * Vecindario BFS + Tier-SybilRank: semillas por tier + opcional whitelist trusted de lab
   * (`trustedSeedsLab.ts`, `VITE_LAB_TRUSTED_*`).
   */
  async getNeighborhoodWithTierSybil(
    centerNodeId: string,
    maxDepth: number,
    sybilOpts?: TierSybilRankOptions
  ): Promise<{ view: NeighborhoodView; tierSybil: TierSybilRankResult }> {
    const view = await this.getNeighborhood(centerNodeId, maxDepth)
    const identities = await getMergedTrustedSeedIdentities()
    const flat = trustedIdentitiesToFlatConfig(identities)
    const trustedReps = resolveTrustedSeedRepresentativesForSybil(new Set(view.nodeIds), identities)
    const trustedAllHits = resolveTrustedSeedsInNodeSet(new Set(view.nodeIds), flat)
    const tierSybil = computeTierSybilRank(view.attestations, {
      nowMs: Date.now(),
      boostSeedNodeIds: [centerNodeId],
      ...sybilOpts,
      trustedSeedNodeIds: sybilOpts?.trustedSeedNodeIds ?? trustedReps,
      trustedSeedAllGraphHits: sybilOpts?.trustedSeedAllGraphHits ?? trustedAllHits,
    })
    return { view, tierSybil }
  }
}
