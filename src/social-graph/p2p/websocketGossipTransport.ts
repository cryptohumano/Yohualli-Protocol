import type { GossipOutboundSendState, GossipTransport } from '@/social-graph/p2p/gossipTransport'
import type { AttestationGossipEnvelope, GossipMessageHandler } from '@/social-graph/p2p/gossipTypes'
import { YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1 } from '@/social-graph/p2p/gossipTypes'

const PING_MS = 25_000
const SYNC_FALLBACK_MS = 2500

function parseEnvelopeRaw(raw: string): AttestationGossipEnvelope | null {
  try {
    const data = JSON.parse(raw) as AttestationGossipEnvelope
    return parseEnvelopeObject(data)
  } catch {
    return null
  }
}

function parseEnvelopeObject(data: unknown): AttestationGossipEnvelope | null {
  if (
    data &&
    typeof data === 'object' &&
    (data as AttestationGossipEnvelope).schemaVersion === 1 &&
    typeof (data as AttestationGossipEnvelope).topic === 'string' &&
    (data as AttestationGossipEnvelope).topic === YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1 &&
    (data as AttestationGossipEnvelope).attestation &&
    typeof (data as AttestationGossipEnvelope).attestation?.id === 'string'
  ) {
    return data as AttestationGossipEnvelope
  }
  return null
}

export type WebSocketGossipTransportOptions = {
  /**
   * Direcciones de interés (p. ej. cuentas locales). El relay solo reenvía gossip donde
   * sujeto **o** atestador está en la lista (reduce exposición a otros pares y al operador).
   * Vacío / omitido = el relay trata “recibir todo” (compatibilidad).
   */
  interestAddresses?: readonly string[]
  /** Tras encolar o marcar envío al relay (para refrescar UI del historial). */
  onOutboundStateChange?: () => void
}

type ParsedWire = { envelope: AttestationGossipEnvelope; seq?: number }

/**
 * Gossip vía WebSocket (relay). Soporta relay con buffer + `yohualli/sync`, filtro `yohualli/watch`,
 * envoltorio `yohualli/gossip` con `seq`, cola local si el socket no está listo.
 */
export class WebSocketGossipTransport implements GossipTransport {
  private ws: WebSocket | null = null
  private onGossip: GossipMessageHandler | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private mixedContentBlock: string | null = null
  private readonly interestAddresses: readonly string[]
  private readonly pendingOutbox: AttestationGossipEnvelope[] = []
  private syncFallbackTimer: ReturnType<typeof setTimeout> | null = null
  /** `queued` hasta `ws.send` exitoso; persiste `sent` en la sesión (memoria). */
  private readonly outboundById = new Map<string, 'queued' | 'sent'>()
  private readonly onOutboundStateChange?: () => void

  constructor(
    private readonly url: string,
    options?: WebSocketGossipTransportOptions
  ) {
    this.interestAddresses = options?.interestAddresses?.length ? [...options.interestAddresses] : []
    this.onOutboundStateChange = options?.onOutboundStateChange
  }

  private notifyOutbound(): void {
    try {
      this.onOutboundStateChange?.()
    } catch {
      /* ignore */
    }
  }

  getOutboundAttestationStatus(attestationId: string): GossipOutboundSendState | undefined {
    const s = this.outboundById.get(attestationId)
    if (s === 'sent') return 'sent'
    if (s === 'queued') {
      return this.isConnected ? 'queued_online' : 'queued_offline'
    }
    return undefined
  }

  private relaySeqStorageKey(): string {
    const u = this.url.trim()
    try {
      const b = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(u))) : u
      return `yohualli-relay-seq:${b.slice(0, 48)}`
    } catch {
      return `yohualli-relay-seq:${u.length}:${u.slice(0, 24)}`
    }
  }

  private readLastSeq(): number {
    try {
      const v = sessionStorage.getItem(this.relaySeqStorageKey())
      const n = Number(v)
      return Number.isFinite(n) && n >= 0 ? n : 0
    } catch {
      return 0
    }
  }

  private writeLastSeq(seq: number): void {
    try {
      sessionStorage.setItem(this.relaySeqStorageKey(), String(seq))
    } catch {
      /* ignore */
    }
  }

  private applyRelaySeq(seq: number | undefined): void {
    if (seq === undefined || !Number.isFinite(seq)) return
    const prev = this.readLastSeq()
    if (seq > prev) this.writeLastSeq(seq)
  }

  private parseIncomingWire(trimmed: string): ParsedWire | null {
    try {
      const o = JSON.parse(trimmed) as { type?: string; seq?: number; body?: unknown }
      if (o.type === 'yohualli/gossip' && o.body) {
        const envelope = parseEnvelopeObject(o.body)
        if (envelope) return { envelope, seq: o.seq }
      }
    } catch {
      /* legacy */
    }
    const envelope = parseEnvelopeRaw(trimmed)
    if (envelope) return { envelope, seq: undefined }
    return null
  }

  private sendInterestWatch(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const subjects =
      this.interestAddresses.length > 0 ? [...this.interestAddresses].slice(0, 64) : []
    this.ws.send(JSON.stringify({ type: 'yohualli/watch', subjects }))
  }

  private sendSyncRequest(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ type: 'yohualli/sync', afterSeq: this.readLastSeq() }))
  }

  /**
   * Vuelve a pedir el buffer del relay desde el principio (afterSeq=0).
   * Útil si `sessionStorage` quedó con un seq alto, el relay reinició, o el sujeto no vio gossip.
   */
  /** @returns false si el socket no está abierto (p. ej. aún conectando). */
  requestCatchupFromZero(): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    this.writeLastSeq(0)
    this.sendSyncRequest()
    this.scheduleSyncFallbackFlush()
    return true
  }

  private clearSyncFallback(): void {
    if (this.syncFallbackTimer) {
      clearTimeout(this.syncFallbackTimer)
      this.syncFallbackTimer = null
    }
  }

  private scheduleSyncFallbackFlush(): void {
    this.clearSyncFallback()
    this.syncFallbackTimer = setTimeout(() => {
      this.syncFallbackTimer = null
      this.flushPendingOutbox()
    }, SYNC_FALLBACK_MS)
  }

  private flushPendingOutbox(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    while (this.pendingOutbox.length > 0) {
      const env = this.pendingOutbox.shift()!
      try {
        this.ws.send(JSON.stringify(env))
        this.outboundById.set(env.attestation.id, 'sent')
        this.notifyOutbound()
      } catch {
        this.pendingOutbox.unshift(env)
        break
      }
    }
  }

  private handleSyncReply(raw: string): void {
    this.clearSyncFallback()
    try {
      const o = JSON.parse(raw) as { type?: string; messages?: string[]; latestSeq?: number }
      if (o.type !== 'yohualli/sync_reply' || !Array.isArray(o.messages)) return
      for (const line of o.messages) {
        const parsed = this.parseIncomingWire(typeof line === 'string' ? line : JSON.stringify(line))
        if (parsed) {
          this.applyRelaySeq(parsed.seq)
          this.onGossip?.(parsed.envelope)
        }
      }
      /** No usar `latestSeq` para avanzar el cursor si `messages` quedó vacío por filtro de intereses en el relay:
       * antes saltábamos al seq más alto sin ingerir nada y los catch-up posteriores fallaban para siempre. */
    } catch {
      /* ignore */
    }
    this.flushPendingOutbox()
  }

  private onSocketOpen = (): void => {
    this.sendInterestWatch()
    this.sendSyncRequest()
    this.scheduleSyncFallbackFlush()
    this.notifyOutbound()
  }

  waitUntilReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.mixedContentBlock) {
        reject(new Error(this.mixedContentBlock))
        return
      }
      const ws = this.ws
      if (!ws) {
        reject(new Error('WebSocket no inicializado; llamá connect() primero'))
        return
      }
      if (ws.readyState === WebSocket.OPEN) {
        resolve()
        return
      }
      const url = this.url.trim()
      const localHint =
        /127\.0\.0\.1|localhost/i.test(url) || url.startsWith('ws://')
          ? ' Comprobá que el relay esté en marcha: en la raíz del repo, `npm run relay:yohualli` (puerto 8080 por defecto; la URL debe coincidir con `PORT`).'
          : ''

      let opened = false
      let settled = false
      const cleanup = () => {
        clearTimeout(to)
        ws.removeEventListener('open', onOpen)
        ws.removeEventListener('error', onErr)
        ws.removeEventListener('close', onClose)
      }
      const fail = (reason: string) => {
        if (settled || opened) return
        settled = true
        cleanup()
        reject(new Error(`${reason} (${url}).${localHint}`))
      }

      const to = setTimeout(() => {
        fail('Timeout esperando WebSocket')
      }, 15_000)

      const onOpen = () => {
        if (settled) return
        opened = true
        settled = true
        cleanup()
        resolve()
      }
      const onErr = () => {
        fail('WebSocket no pudo conectar (ECONNREFUSED suele indicar que nadie escucha en ese host/puerto)')
      }
      const onClose = (ev: CloseEvent) => {
        if (opened) return
        fail(`WebSocket cerrado antes de abrir (código ${ev.code}${ev.reason ? `: ${ev.reason}` : ''})`)
      }
      ws.addEventListener('open', onOpen, { once: true })
      ws.addEventListener('error', onErr, { once: true })
      ws.addEventListener('close', onClose, { once: true })
    })
  }

  connect(): void {
    this.disconnect()
    let resolved = this.url.trim()
    if (!resolved) {
      console.warn('[Yohualli P2P] URL de relay vacía')
      return
    }
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      resolved.startsWith('ws://')
    ) {
      this.mixedContentBlock =
        'Página HTTPS: el navegador bloquea ws:// (mixed content). Con Vite usá wss:// al proxy (botón "Proxy /__yohualli_relay" en Atestaciones), o un relay con TLS (wss://).'
      console.warn('[Yohualli P2P]', this.mixedContentBlock)
      return
    }
    this.mixedContentBlock = null
    this.ws = new WebSocket(resolved)
    this.ws.addEventListener('open', this.onSocketOpen)
    this.ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return
      const trimmed = ev.data.trim()
      try {
        const ctl = JSON.parse(trimmed) as { type?: string }
        if (ctl?.type === 'pong' || ctl?.type === 'ping') return
        if (ctl?.type === 'yohualli/sync_reply') {
          this.handleSyncReply(trimmed)
          return
        }
      } catch {
        /* continuar */
      }
      const parsed = this.parseIncomingWire(trimmed)
      if (parsed) {
        this.applyRelaySeq(parsed.seq)
        this.onGossip?.(parsed.envelope)
      }
    }
    this.ws.onerror = () => {
      console.warn('[Yohualli P2P] WebSocket error', resolved)
    }
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', t: Date.now() }))
      }
    }, PING_MS)
  }

  setOnGossip(handler: GossipMessageHandler | null): void {
    this.onGossip = handler
  }

  publish(envelope: AttestationGossipEnvelope): void {
    const id = envelope.attestation.id
    if (this.outboundById.get(id) === 'sent') {
      return
    }
    const dup = this.pendingOutbox.findIndex((e) => e.attestation.id === id)
    if (dup >= 0) this.pendingOutbox.splice(dup, 1)

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingOutbox.push(envelope)
      this.outboundById.set(id, 'queued')
      this.notifyOutbound()
      console.warn(
        '[Yohualli P2P] WebSocket no conectado; atestación en cola local (se enviará al reconectar el relay)'
      )
      return
    }
    try {
      this.ws.send(JSON.stringify(envelope))
      this.outboundById.set(id, 'sent')
      this.notifyOutbound()
    } catch {
      this.pendingOutbox.push(envelope)
      this.outboundById.set(id, 'queued')
      this.notifyOutbound()
    }
  }

  disconnect(): void {
    this.mixedContentBlock = null
    this.clearSyncFallback()
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.ws?.removeEventListener('open', this.onSocketOpen)
    this.ws?.close()
    this.ws = null
    this.notifyOutbound()
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
