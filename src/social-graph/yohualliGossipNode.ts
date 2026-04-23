import type { SocialAttestation } from '@/social-graph/types/graph'
import { SocialGraphService } from '@/social-graph/socialGraphService'
import { BroadcastChannelGossipTransport } from '@/social-graph/p2p/broadcastChannelGossip'
import type { GossipOutboundSendState, GossipTransport } from '@/social-graph/p2p/gossipTransport'
import {
  YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1,
  type AttestationGossipEnvelope,
} from '@/social-graph/p2p/gossipTypes'

export type GraphUpdatedListener = () => void

/**
 * Orquesta ingreso al grafo local + difusión Gossip (BroadcastChannel / WebSocket relay).
 */
export class YohualliGossipNode {
  private readonly transport: GossipTransport
  private readonly graph: SocialGraphService
  private listeners = new Set<GraphUpdatedListener>()

  constructor(graph: SocialGraphService, transport?: GossipTransport) {
    this.graph = graph
    this.transport = transport ?? new BroadcastChannelGossipTransport()
  }

  subscribe(cb: GraphUpdatedListener): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  private emitUpdate(): void {
    for (const cb of this.listeners) {
      try {
        cb()
      } catch (e) {
        console.error('[YohualliGossipNode] listener error', e)
      }
    }
  }

  async start(): Promise<void> {
    this.transport.connect()
    this.transport.setOnGossip(async (env: AttestationGossipEnvelope) => {
      const res = await this.graph.ingestAttestation(env.attestation, true)
      if (res.ok && res.reason !== 'Deduplicada') {
        this.emitUpdate()
      } else if (res.ok && res.reason === 'Deduplicada') {
        /* no-op */
      } else {
        console.warn('[YohualliGossipNode] ingesta rechazada (firma o política de grafo):', res.reason)
      }
    })
    try {
      await this.transport.waitUntilReady?.()
    } catch (e) {
      console.error('[YohualliGossipNode] transporte no listo:', e)
      this.transport.setOnGossip(null)
      this.transport.disconnect()
      return
    }
  }

  stop(): void {
    this.transport.setOnGossip(null)
    this.transport.disconnect()
  }

  get connected(): boolean {
    return this.transport.isConnected
  }

  /** Solo con transporte que lo implemente (p. ej. WebSocket); memoria de sesión. */
  getOutboundAttestationStatus(attestationId: string): GossipOutboundSendState | undefined {
    return this.transport.getOutboundAttestationStatus?.(attestationId)
  }

  async publishAttestation(att: SocialAttestation): Promise<void> {
    const local = await this.graph.ingestAttestation(att, true)
    if (!local.ok) {
      throw new Error(local.reason ?? 'No se pudo guardar la atestación')
    }
    this.emitUpdate()
    const envelope: AttestationGossipEnvelope = {
      schemaVersion: 1,
      topic: YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1,
      attestation: att,
    }
    this.transport.publish(envelope)
  }

  /**
   * Reenvía al relay las firmas hechas con cuentas locales que el transporte WSS aún no marcó como `sent`.
   * Cubre el caso: firmaste con transporte Broadcast (o sin URL WS), luego pasás a WebSocket y conectás gossip.
   */
  async replayUnsentLocalAttestationsToRelay(localAttesterAddresses: readonly string[]): Promise<void> {
    if (typeof this.transport.getOutboundAttestationStatus !== 'function') return
    if (!localAttesterAddresses.length) return
    const allowed = new Set(localAttesterAddresses)
    const hist = await this.graph.listAttestationHistory()
    for (const att of hist) {
      if (!allowed.has(att.attesterAddress)) continue
      if (this.transport.getOutboundAttestationStatus?.(att.id) === 'sent') continue
      const envelope: AttestationGossipEnvelope = {
        schemaVersion: 1,
        topic: YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1,
        attestation: att,
      }
      this.transport.publish(envelope)
    }
  }

  /** Solo WebSocket: nuevo `sync` con afterSeq=0 (el grafo deduplica ids ya vistos). */
  requestRelayCatchupFromZero(): boolean {
    return this.transport.requestCatchupFromZero?.() ?? false
  }
}
