import type { SocialAttestation } from '@/social-graph/types/graph'

export const YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1 = 'yohualli/v1/attestations' as const

export type AttestationGossipEnvelope = {
  schemaVersion: 1
  topic: typeof YOHUALLI_GOSSIP_TOPIC_ATTESTATIONS_V1
  attestation: SocialAttestation
}

export type GossipMessageHandler = (envelope: AttestationGossipEnvelope) => void
