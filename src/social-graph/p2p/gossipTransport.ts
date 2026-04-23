import type { AttestationGossipEnvelope, GossipMessageHandler } from '@/social-graph/p2p/gossipTypes'

/** Estado de envío saliente al relay (solo transportes que lo implementen, p. ej. WebSocket). */
export type GossipOutboundSendState = 'sent' | 'queued_online' | 'queued_offline'

/**
 * Transporte mínimo para difundir envelopes de atestación (BroadcastChannel, WebSocket, etc.).
 */
export interface GossipTransport {
  connect(): void
  /** Si existe, el nodo puede esperar antes de registrar handlers (p. ej. WebSocket async). */
  waitUntilReady?(): Promise<void>
  setOnGossip(handler: GossipMessageHandler | null): void
  publish(envelope: AttestationGossipEnvelope): void
  disconnect(): void
  readonly isConnected: boolean
  /** Solo si el transporte registra publicaciones salientes (memoria de sesión). */
  getOutboundAttestationStatus?(attestationId: string): GossipOutboundSendState | undefined
  /** WebSocket: nuevo `sync` con afterSeq=0; devuelve false si el socket no está listo. */
  requestCatchupFromZero?(): boolean
}
