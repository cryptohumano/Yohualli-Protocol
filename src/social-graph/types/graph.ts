/**
 * Modelo local del grafo social (Yohualli, off-chain).
 * Los nodos son identidades Substrate (SS58); las aristas son atestaciones firmadas.
 * Convive con `src/circuits/`: allí van pruebas y verificación ZK; aquí solo el grafo y el gossip.
 */

export interface GraphNode {
  /** Dirección SS58 (substrate) */
  nodeId: string
  firstSeenAt: number
  lastSeenAt: number
  /** Si corresponde a la cuenta activa en esta PWA */
  isLocal?: boolean
  label?: string
}

/**
 * Ancla off-chain reenviable (mismo `topic` de gossip) alineada con
 * `docs/YOHUALLI_ATTESTATION_SIGNING_V0.md`.
 */
export interface YohualliEip712V0Bundle {
  signature: `0x${string}`
  signerAddress: `0x${string}`
  subjectCommitment: `0x${string}`
  chainId: number
  /** uint64 en decimal (JSON-safe). */
  epoch: string
  schemaId: `0x${string}`
}

export interface SocialAttestation {
  /** Hash determinístico (hex 0x…) para deduplicar */
  id: string
  subjectAddress: string
  attesterAddress: string
  contextId: string
  trustTier: number
  timestampMs: number
  /** Firma sobre `signingPayloadUtf8` */
  signatureHex: string
  /** Payload exacto firmado (UTF-8), para re-verificación al ingerir */
  signingPayloadUtf8: string
  /**
   * Opcional: `eth_signTypedData` Yohualli (EOA m/44'/60'/10'/0/0). El relay reenvía el `SocialAttestation` completo.
   */
  eip712V0?: YohualliEip712V0Bundle
}

export interface GraphStats {
  nodeCount: number
  attestationCount: number
}

export interface NeighborhoodView {
  depth: number
  centerNodeId: string
  nodeIds: string[]
  attestations: SocialAttestation[]
}

/** Nodo para react-force-graph (2D). */
export interface GraphVizNode {
  id: string
  label: string
  hopFromCenter: number
  degree: number
  isCenter: boolean
  /** “masa” en la simulación (grado + sesgo). */
  val: number
  /** Score 0..1 (propagación tipo SybilRank ponderada por tiers; ver `computeTierSybilRank`). */
  sybilRank01?: number
}

/** Arista dirigida atestador → sujeto con métricas de lab. */
export interface GraphVizLink {
  source: string
  target: string
  weight: number
  freshness: number
  trustTier: number
  attestationId: string
  minHopFromCenter: number
}

export interface GraphVizData {
  nodes: GraphVizNode[]
  links: GraphVizLink[]
}
