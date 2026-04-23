import type { GossipTransport } from '@/social-graph/p2p/gossipTransport'
import type { AttestationGossipEnvelope, GossipMessageHandler } from '@/social-graph/p2p/gossipTypes'
import { YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1 } from '@/social-graph/p2p/gossipTypes'

const DEFAULT_CHANNEL = 'aura-yohualli-gossip-v1'

/**
 * Transporte Gossip mínimo para desarrollo: sincroniza entre pestañas del mismo origen.
 */
export class BroadcastChannelGossipTransport implements GossipTransport {
  private channel: BroadcastChannel | null = null
  private onGossip: GossipMessageHandler | null = null

  constructor(private readonly channelName: string = DEFAULT_CHANNEL) {}

  connect(): void {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[Yohualli P2P] BroadcastChannel no disponible en este entorno')
      return
    }
    this.disconnect()
    this.channel = new BroadcastChannel(this.channelName)
    this.channel.onmessage = (ev: MessageEvent<AttestationGossipEnvelope>) => {
      const data = ev.data
      if (
        data &&
        data.schemaVersion === 1 &&
        data.topic === YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1 &&
        data.attestation?.id
      ) {
        this.onGossip?.(data)
      }
    }
  }

  setOnGossip(handler: GossipMessageHandler | null): void {
    this.onGossip = handler
  }

  publish(envelope: AttestationGossipEnvelope): void {
    if (!this.channel) return
    this.channel.postMessage(envelope)
  }

  disconnect(): void {
    this.channel?.close()
    this.channel = null
  }

  get isConnected(): boolean {
    return this.channel !== null
  }
}
