import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { decodeAddress } from '@polkadot/util-crypto'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { SocialGraphService } from '@/social-graph/socialGraphService'
import { defaultYohualliGraphRepository } from '@/social-graph/graphRepository'
import { DEFAULT_GRAPH_INGEST_POLICY } from '@/social-graph/graphIngestPolicy'
import { verifyTrustedSeedLabAccount } from '@/social-graph/trustedSeedsLab'
import { YohualliGossipNode } from '@/social-graph/yohualliGossipNode'
import { BroadcastChannelGossipTransport } from '@/social-graph/p2p/broadcastChannelGossip'
import { WebSocketGossipTransport } from '@/social-graph/p2p/websocketGossipTransport'
import { buildYohualliWatchSubjectList } from '@/social-graph/p2p/relayInterestAddresses'
import type { GraphStats, GraphVizData, NeighborhoodView, SocialAttestation } from '@/social-graph/types/graph'
import { buildGraphVizData } from '@/social-graph/graphVisualization'
import { getKeypairType, isSecp256k1Family, keypairTypeBadgeVariant } from '@/utils/keyringDisplay'
import { DualSubstrateAddressLines } from '@/components/DualSubstrateAddressLines'
import { SocialGraphForceView } from '@/social-graph/SocialGraphForceView'
import { AttestationQrPanel } from '@/social-graph/AttestationQrPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { format } from 'date-fns'
import { Braces, FileSignature, GitBranch, History, Network, Share2, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  hasYohualliSubstrateDerivationInSuri,
  YOHUALLI_SUBSTRATE_DERIVATION,
} from '@/social-graph/yohualliSubstratePath'
import { paseoPassetHub } from '@/config/paseoEvm'
import {
  getDefaultYohualliRelayWsForAttestations,
  getYohualliRelayRailwayUrl,
} from '@/config/yohualliRelayPublic'
import {
  getYohualliAttestationSignerFromHdSuri,
  signYohualliAttestationV0FromHdSuri,
  toYohualliEip712V0Bundle,
  YOHUALLI_ATTESTATION_BIP44_PATH,
  YOHUALLI_ATTESTATION_V0_SCHEMA_ID,
} from '@/utils/yohualliAttestationEip712'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type TransportKind = 'broadcast' | 'websocket'

function assertValidAddress(addr: string): void {
  decodeAddress(addr.trim())
}

function shortSs58(addr: string): string {
  if (addr.length <= 20) return addr
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`
}

/** Relay escuchando en la máquina donde corre Node (ver `relay/README.md`). */
const DIRECT_RELAY_WS = 'ws://127.0.0.1:8080'

const RAILWAY_RELAY_PRESET = getYohualliRelayRailwayUrl()

/** En `vite dev`, el proxy `/__yohualli_relay` evita que el browser abra 127.0.0.1 (falla en IDE/port-forward). */
function relayUrlViaViteProxy(): string {
  if (typeof window === 'undefined') return DIRECT_RELAY_WS
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/__yohualli_relay`
}

function isMixedContentWsOnHttps(url: string): boolean {
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'https:' && url.trim().startsWith('ws://')
}

/** Primer carga: relay por env, Railway, o (solo dev) proxy de Vite; ajusta mixed content del ws:// bajo https. */
function getInitialAttestationsRelayState(): { transport: TransportKind; url: string } {
  const base = getDefaultYohualliRelayWsForAttestations()
  if (base) {
    let u = base
    if (typeof window !== 'undefined' && isMixedContentWsOnHttps(u)) u = relayUrlViaViteProxy()
    return { transport: 'websocket', url: u }
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return { transport: 'websocket', url: relayUrlViaViteProxy() }
  }
  return { transport: 'broadcast', url: '' }
}

const RELAY_UI_GRACE_MS = 10_000

export default function Attestations() {
  const { t } = useTranslation('pages')
  const { accounts, isUnlocked, activeAccountAddress } = useKeyringContext()
  const initialRelay = useMemo(() => getInitialAttestationsRelayState(), [])
  const [transportKind, setTransportKind] = useState<TransportKind>(() => initialRelay.transport)
  const [relayWsUrl, setRelayWsUrl] = useState(() => initialRelay.url)
  /** Tras 10 s en la página, o al fallar el WS, o si el usuario abre, mostramos URL/atajos. Mientras, solo auto-conexión. */
  const [inRelayConfigGrace, setInRelayConfigGrace] = useState(true)
  const [relayWssAutoconnectFailed, setRelayWssAutoconnectFailed] = useState(false)
  const [userOpenedRelayConfig, setUserOpenedRelayConfig] = useState(false)
  const [subjectAddress, setSubjectAddress] = useState('')
  /** Cuenta propia cuyo SS58 va en el QR como solicitante (solo cuentas locales). */
  const [qrRequestAccount, setQrRequestAccount] = useState('')
  const [, setConnBump] = useState(0)
  const outboundUiBumpRef = useRef<() => void>(() => {})
  outboundUiBumpRef.current = () => setConnBump((n) => n + 1)

  const graph = useMemo(
    () => new SocialGraphService(defaultYohualliGraphRepository),
    []
  )

  const gossipNode = useMemo(() => {
    const interestList = buildYohualliWatchSubjectList(accounts, {
      qrRequestField: qrRequestAccount.trim() || undefined,
      subjectField: subjectAddress.trim() || undefined,
    })

    const transport =
      transportKind === 'websocket' && relayWsUrl.trim()
        ? new WebSocketGossipTransport(relayWsUrl.trim(), {
            interestAddresses: interestList.length > 0 ? interestList : undefined,
            onOutboundStateChange: () => outboundUiBumpRef.current(),
          })
        : new BroadcastChannelGossipTransport()
    return new YohualliGossipNode(graph, transport)
  }, [graph, transportKind, relayWsUrl, accounts, qrRequestAccount, subjectAddress])

  const [p2pOn, setP2pOn] = useState(false)

  const showWebsocketRelayConfigFields = useMemo(() => {
    if (transportKind !== 'websocket') return true
    if (typeof window !== 'undefined' && isMixedContentWsOnHttps(relayWsUrl)) return true
    if (userOpenedRelayConfig) return true
    if (relayWssAutoconnectFailed) return true
    return !inRelayConfigGrace
  }, [
    inRelayConfigGrace,
    relayWssAutoconnectFailed,
    relayWsUrl,
    transportKind,
    userOpenedRelayConfig,
  ])

  useLayoutEffect(() => {
    if (initialRelay.transport !== 'websocket' || !initialRelay.url.trim()) return
    setP2pOn(true)
  }, [initialRelay])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = window.setTimeout(() => setInRelayConfigGrace(false), RELAY_UI_GRACE_MS)
    return () => clearTimeout(id)
  }, [])
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [selectedAttester, setSelectedAttester] = useState('')
  const [subjectLockedFromQr, setSubjectLockedFromQr] = useState(false)
  /** Solo para pruebas: permite escribir el sujeto sin escanear (no recomendado en ceremonias). */
  const [subjectManualLab, setSubjectManualLab] = useState(false)
  const [contextId, setContextId] = useState('yohualli-lab')
  const [trustTier, setTrustTier] = useState('1')
  const [hood, setHood] = useState<NeighborhoodView | null>(null)
  const [vizData, setVizData] = useState<GraphVizData | null>(null)
  /** Resumen del último cálculo tier-SybilRank (semillas implícitas por tier emitido). */
  const [tierSybilMeta, setTierSybilMeta] = useState<{
    seedCount: number
    thresholdUsed: number
    trustedLabHit: number
  } | null>(null)
  const [attestationHistory, setAttestationHistory] = useState<SocialAttestation[]>([])
  const [hoodDepth, setHoodDepth] = useState('2')
  const [lastError, setLastError] = useState<string | null>(null)
  /** Epoch EIP-712 (uint64): por defecto segundos UNIX; editable en laboratorio. */
  const [eip712EpochSec, setEip712EpochSec] = useState(() => String(Math.floor(Date.now() / 1000)))
  const [eip712SignBusy, setEip712SignBusy] = useState(false)
  const [eip712Bundle, setEip712Bundle] = useState<{
    signature: `0x${string}`
    signerAddress: `0x${string}`
    subjectCommitment: `0x${string}`
  } | null>(null)
  /** Incluir `eip712V0` al publicar (IndexedDB + gossip + relay) si hay `hdDerivationSuri`. */
  const [includeEip712OnPublish, setIncludeEip712OnPublish] = useState(true)
  const [graphJsonDialogAtt, setGraphJsonDialogAtt] = useState<SocialAttestation | null>(null)

  const selectedAttesterPairType = useMemo(() => {
    const a = accounts.find((x) => x.address === selectedAttester)
    return a ? getKeypairType(a.pair) : null
  }, [accounts, selectedAttester])

  const selectedAttesterYohualliSuri = useMemo(() => {
    const a = accounts.find((x) => x.address === selectedAttester)
    if (!a?.hdDerivationSuri) return { known: false as const, hasPath: false as const }
    return {
      known: true as const,
      hasPath: hasYohualliSubstrateDerivationInSuri(a.hdDerivationSuri) as boolean,
    }
  }, [accounts, selectedAttester])

  const trustedLabVerification = useMemo(() => {
    if (!selectedAttester || !isUnlocked) return null
    const acc = accounts.find((a) => a.address === selectedAttester)
    if (!acc) return null
    return verifyTrustedSeedLabAccount({
      substrateAddress: acc.address,
      evmBip44Address: acc.evmBip44Address ?? null,
    })
  }, [accounts, isUnlocked, selectedAttester])

  const refreshUi = useCallback(async () => {
    const [s, h] = await Promise.all([graph.getStats(), graph.listAttestationHistory()])
    setStats(s)
    setAttestationHistory(h)
  }, [graph])

  useEffect(() => {
    void refreshUi()
  }, [refreshUi])

  useEffect(() => {
    if (!p2pOn) {
      gossipNode.stop()
      return
    }
    let unsub: (() => void) | undefined
    let cancelled = false
    void gossipNode
      .start()
      .then(() => {
        if (cancelled) return
        setRelayWssAutoconnectFailed(false)
        unsub = gossipNode.subscribe(() => {
          void refreshUi()
          setConnBump((n) => n + 1)
        })
        setConnBump((n) => n + 1)
        if (transportKind === 'websocket' && relayWsUrl.trim()) {
          void gossipNode.replayUnsentLocalAttestationsToRelay(accounts.map((a) => a.address)).then(() => {
            if (cancelled) return
            setConnBump((n) => n + 1)
            void refreshUi()
          })
        }
      })
      .catch((e) => {
        if (cancelled) return
        if (transportKind === 'websocket') {
          setRelayWssAutoconnectFailed(true)
        }
        setLastError(e instanceof Error ? e.message : String(e))
        setP2pOn(false)
      })
    return () => {
      cancelled = true
      unsub?.()
      gossipNode.stop()
    }
  }, [p2pOn, gossipNode, refreshUi, accounts, transportKind, relayWsUrl])

  useEffect(() => {
    if (!accounts.length || !activeAccountAddress) return
    if (!selectedAttester || !accounts.some((a) => a.address === selectedAttester)) {
      setSelectedAttester(activeAccountAddress)
    }
  }, [accounts, selectedAttester, activeAccountAddress])

  useEffect(() => {
    if (!accounts.length || !activeAccountAddress) return
    const valid = accounts.some((a) => a.address === qrRequestAccount)
    if (!qrRequestAccount || !valid) {
      setQrRequestAccount(activeAccountAddress)
    }
  }, [accounts, qrRequestAccount, activeAccountAddress])

  const handleMarkLocal = async () => {
    setLastError(null)
    if (!selectedAttester) return
    try {
      assertValidAddress(selectedAttester)
      await graph.setLocalNodeHint(selectedAttester.trim())
      await refreshUi()
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    }
  }

  const handlePublish = async () => {
    setLastError(null)
    if (!isUnlocked) {
      setLastError('Desbloquee el keyring para firmar atestaciones.')
      return
    }
    const acc = accounts.find((a) => a.address === selectedAttester)
    if (!acc) {
      setLastError('Selecciona una cuenta atestadora.')
      return
    }
    if (!acc.hdDerivationSuri) {
      setLastError(
        `Yohualli requiere cuenta con frase o SURI (no basta con JSON de Polkadot.js) para asegurar la ruta ${YOHUALLI_SUBSTRATE_DERIVATION} en el material importado.`
      )
      return
    }
    if (!hasYohualliSubstrateDerivationInSuri(acc.hdDerivationSuri)) {
      setLastError(
        `El atestador debe publicar con SURI que incluya la derivación fija ${YOHUALLI_SUBSTRATE_DERIVATION}. Volvé a importar la frase/URI bajo Cuentas (o usá otra cuenta ya añadida con esa ruta).`
      )
      return
    }
    try {
      if (!subjectLockedFromQr && !subjectManualLab) {
        setLastError(
          'Indique el sujeto escaneando un código QR de solicitud o active el modo laboratorio para editar la dirección manualmente.'
        )
        return
      }
      assertValidAddress(subjectAddress)
      const tier = Number.parseInt(trustTier, 10)
      if (!Number.isFinite(tier) || tier < 0) {
        setLastError('Trust tier inválido.')
        return
      }
      if (includeEip712OnPublish && acc.hdDerivationSuri && (tier > 255 || !Number.isInteger(tier))) {
        setLastError('Con ancla EIP-712, trust tier debe ser entero 0–255.')
        return
      }
      const ctx = contextId.trim() || 'default'
      let eip712V0: SocialAttestation['eip712V0'] | undefined
      if (includeEip712OnPublish && acc.hdDerivationSuri) {
        const epochParsed = BigInt(eip712EpochSec.trim() || '0')
        if (epochParsed < 0n || epochParsed > 18446744073709551615n) {
          setLastError('Epoch EIP-712 fuera de rango uint64 (revisar campo en la sección inferior).')
          return
        }
        const eipSign = await signYohualliAttestationV0FromHdSuri(acc.hdDerivationSuri, {
          contextId: ctx,
          epoch: epochParsed,
          subjectSs58: subjectAddress.trim(),
          thresholdBucket: tier,
        })
        eip712V0 = toYohualliEip712V0Bundle(eipSign, {
          chainId: paseoPassetHub.id,
          epoch: epochParsed,
        })
      }
      const att = await graph.buildAndSignAttestation({
        pair: acc.pair,
        subjectAddress: subjectAddress.trim(),
        contextId: ctx,
        trustTier: tier,
        eip712V0,
      })
      /** Siempre `publishAttestation`: ingiere en el grafo y llama al transporte.
       * Con WebSocket y gossip apagado, el transporte igual encola en memoria hasta reconectar
       * (antes solo se guardaba local y nunca llegaba al relay). */
      await gossipNode.publishAttestation(att)
      setConnBump((n) => n + 1)
      await refreshUi()
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleNeighborhood = async () => {
    setLastError(null)
    if (!selectedAttester) return
    try {
      assertValidAddress(selectedAttester)
      const d = Number.parseInt(hoodDepth, 10)
      if (!Number.isFinite(d) || d < 1 || d > 6) {
        setLastError('Profundidad entre 1 y 6.')
        return
      }
      const { view, tierSybil } = await graph.getNeighborhoodWithTierSybil(selectedAttester.trim(), d)
      setHood(view)
      setTierSybilMeta({
        seedCount: tierSybil.seedNodeIds.length,
        thresholdUsed: tierSybil.implicitSeedTierThresholdUsed,
        trustedLabHit: tierSybil.labTrustedSeedNodeIdsHit.length,
      })
      setVizData(buildGraphVizData(view, Date.now(), tierSybil))
    } catch (e) {
      setTierSybilMeta(null)
      setLastError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleApplyQrRequest = useCallback(
    (data: { subjectAddress: string; contextId: string; trustTier: number }) => {
      setSubjectAddress(data.subjectAddress)
      setContextId(data.contextId)
      setTrustTier(String(data.trustTier))
      setSubjectLockedFromQr(true)
      setSubjectManualLab(false)
      setLastError(null)
    },
    []
  )

  const handleUnlockSubjectFromQr = useCallback(() => {
    setSubjectLockedFromQr(false)
    setSubjectAddress('')
    setLastError(null)
  }, [])

  const handleClear = async () => {
    setLastError(null)
    try {
      await graph.clearAll()
      setHood(null)
      setVizData(null)
      setTierSybilMeta(null)
      setSubjectLockedFromQr(false)
      setSubjectManualLab(false)
      setSubjectAddress('')
      await refreshUi()
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleReplayLocalToRelay = useCallback(async () => {
    setLastError(null)
    if (transportKind !== 'websocket' || !relayWsUrl.trim()) return
    try {
      await gossipNode.replayUnsentLocalAttestationsToRelay(accounts.map((a) => a.address))
      setConnBump((n) => n + 1)
      await refreshUi()
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    }
  }, [accounts, gossipNode, refreshUi, relayWsUrl, transportKind])

  const selectedHdSuri = useMemo(() => {
    const acc = accounts.find((a) => a.address === selectedAttester)
    return acc?.hdDerivationSuri
  }, [accounts, selectedAttester])

  const yohualliAttestEvmPreview = useMemo(() => {
    if (!selectedHdSuri) return null
    return getYohualliAttestationSignerFromHdSuri(selectedHdSuri)?.address ?? null
  }, [selectedHdSuri])

  const handleSignYohualliEip712 = async () => {
    setLastError(null)
    setEip712Bundle(null)
    if (!isUnlocked) {
      setLastError('Desbloquee el keyring para firmar EIP-712.')
      return
    }
    if (!selectedHdSuri) {
      setLastError(
        'Esta cuenta no tiene material BIP39 en memoria (p. ej. importación solo desde JSON de Polkadot.js). Creá o importá con frase o SURI para usar la ruta de atestación sin extensión.'
      )
      return
    }
    if (!hasYohualliSubstrateDerivationInSuri(selectedHdSuri)) {
      setLastError(
        `La SURI de la cuenta debe incluir la derivación ${YOHUALLI_SUBSTRATE_DERIVATION} (identidad Yohualli).`
      )
      return
    }
    if (!subjectLockedFromQr && !subjectManualLab) {
      setLastError('Definí el sujeto (QR o modo laboratorio) antes de firmar el mensaje EIP-712.')
      return
    }
    try {
      assertValidAddress(subjectAddress)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
      return
    }
    const epochParsed = BigInt(eip712EpochSec.trim() || '0')
    if (epochParsed < 0n || epochParsed > 18446744073709551615n) {
      setLastError('Epoch fuera de rango uint64.')
      return
    }
    const tier = Number.parseInt(trustTier, 10)
    if (!Number.isFinite(tier) || tier < 0 || tier > 255) {
      setLastError('Trust tier debe ser entero 0–255 para thresholdBucket EIP-712.')
      return
    }
    setEip712SignBusy(true)
    try {
      const { signature, signerAddress, subjectCommitment } = await signYohualliAttestationV0FromHdSuri(
        selectedHdSuri,
        {
          contextId: contextId.trim() || 'yohualli-lab',
          epoch: epochParsed,
          subjectSs58: subjectAddress.trim(),
          thresholdBucket: tier,
        }
      )
      setEip712Bundle({ signature, signerAddress, subjectCommitment })
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    } finally {
      setEip712SignBusy(false)
    }
  }

  const handleRelayCatchupFromZero = useCallback(() => {
    setLastError(null)
    const ok = gossipNode.requestRelayCatchupFromZero()
    if (!ok) {
      setLastError(
        'No se pudo enviar sync al relay (socket no abierto). Esperá a que el estado muestre enlace listo o reconectá gossip.'
      )
      return
    }
    void refreshUi()
    setConnBump((n) => n + 1)
  }, [gossipNode, refreshUi])

  const canConnectWs = transportKind !== 'websocket' || relayWsUrl.trim().length > 0

  const renderGossipOutboundCell = useCallback(
    (att: SocialAttestation) => {
      const localAttest = accounts.some((a) => a.address === att.attesterAddress)
      if (!localAttest) {
        return (
          <span className="text-muted-foreground text-xs" title="Atestación no emitida desde esta PWA">
            —
          </span>
        )
      }
      if (transportKind !== 'websocket' || !relayWsUrl.trim()) {
        return (
          <span
            className="text-xs text-muted-foreground"
            title="El estado de relay solo se registra con transporte WebSocket"
          >
            {p2pOn ? 'BC' : 'Local'}
          </span>
        )
      }
      const st = gossipNode.getOutboundAttestationStatus(att.id)
      if (st === 'sent') {
        return <Badge variant="default">Transmitido</Badge>
      }
      if (st === 'queued_offline') {
        return (
          <Badge variant="secondary" title="En cola hasta conectar gossip al relay">
            Pendiente · sin WSS
          </Badge>
        )
      }
      if (st === 'queued_online') {
        return (
          <Badge variant="secondary" title="Socket abierto: se envía al relay al vaciar la cola">
            Pendiente · WSS
          </Badge>
        )
      }
      return (
        <Badge
          variant="outline"
          title="Sin registro de envío en esta sesión (p. ej. otra instancia de transporte o dato antiguo)"
        >
          Inactivo
        </Badge>
      )
    },
    [accounts, gossipNode, p2pOn, relayWsUrl, transportKind]
  )

  const publishLabel = useMemo(() => {
    return transportKind === 'websocket' && relayWsUrl.trim()
      ? p2pOn
        ? t('attestations.publishWSSon')
        : t('attestations.publishWSSoff')
      : p2pOn
        ? t('attestations.publishBC')
        : t('attestations.publishLocal')
  }, [p2pOn, relayWsUrl, transportKind, t])

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('attestations.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          <Trans
            i18nKey="pages:attestations.lead"
            components={[
              <code className="text-xs" key="0" />,
              <code className="text-xs" key="1" />,
              <code className="text-xs" key="2" />,
            ]}
          />
        </p>
        <Alert className="mt-3">
          <Network className="h-4 w-4" />
          <AlertTitle className="text-sm">{t('attestations.alertMerkleTitle')}</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground space-y-1.5">
            <p>
              Aquí <strong>firmáis y guardáis</strong> atestaciones en el grafo local; el <code className="text-xs">subjectCommitment</code>{' '}
              (v0) queda en el payload EIP-712, pero <strong>no se publica solo</strong> en{' '}
              <code className="text-xs">MerkleHonkRegistry</code>. La raíz por <em>epoch</em> y el lote de
              hojas lo fija un <strong>operador</strong> fuera de esta pantalla (scripts/Foundry). Puntuación
              (Tier-Sybil, trusted de lab) se calcula en la app, no on-chain. Guía de actores:{' '}
              <code className="text-[10px]">docs/YOHUALLI_FLUJOS_UX_ACTORES.md</code> en el repositorio.
            </p>
          </AlertDescription>
        </Alert>
        <Alert className="mt-3">
          <AlertTitle className="text-sm">Política de ingesta del grafo (lab)</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground space-y-1.5">
            <p>
              Antes de guardar una atestación (local o vía gossip) se aplican comprobaciones inspiradas en el
              borrador Yohualli §4.3: sin auto-atestación; ráfaga mínima{' '}
              <code className="text-[11px]">{DEFAULT_GRAPH_INGEST_POLICY.minMsBetweenAttesterToSameSubject}ms</code>{' '}
              entre misma arista atestador→sujeto; repetición del mismo{' '}
              <code className="text-[11px]">contextId</code> en el par tras{' '}
              <code className="text-[11px]">
                {Math.round(DEFAULT_GRAPH_INGEST_POLICY.minMsRepeatAttesterSubjectContext / 1000)}s
              </code>
              ; máximo{' '}
              <code className="text-[11px]">{DEFAULT_GRAPH_INGEST_POLICY.maxDirectedAttesterToSubjectPerMinute}</code>{' '}
              atestaciones/min atestador→sujeto; máximo{' '}
              <code className="text-[11px]">{DEFAULT_GRAPH_INGEST_POLICY.maxUndirectedPairAttestationsPerHour}</code>{' '}
              aristas mutuas entre el par en 1h; máximo{' '}
              <code className="text-[11px]">{DEFAULT_GRAPH_INGEST_POLICY.maxInboundToSubjectPerMinute}</code>{' '}
              entrantes/min al sujeto; trust tier{' '}
              <code className="text-[11px]">
                {DEFAULT_GRAPH_INGEST_POLICY.trustTierMin}–{DEFAULT_GRAPH_INGEST_POLICY.trustTierMax}
              </code>
              . SybilRank, conductancia y VRF quedan para fases posteriores.
            </p>
          </AlertDescription>
        </Alert>
      </div>

      {lastError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {lastError}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Network className="h-5 w-5" />
            {t('attestations.p2pTitle')}
          </CardTitle>
          <CardDescription>
            <Trans
              i18nKey="pages:attestations.p2pDesc"
              components={[
                <strong key="0" />,
                <strong key="1" />,
                <strong key="2" />,
                <strong key="3" />,
              ]}
            />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="transport">{t('attestations.labelTransport')}</Label>
            <select
              id="transport"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              value={transportKind}
              disabled={p2pOn}
              onChange={(e) => {
                const v = e.target.value as TransportKind
                setTransportKind(v)
                if (v === 'websocket') {
                  setRelayWsUrl((prev) => {
                    const cur = prev.trim()
                    if (cur !== '') return prev
                    if (typeof window === 'undefined') return prev
                    return window.location.protocol === 'https:' ? relayUrlViaViteProxy() : DIRECT_RELAY_WS
                  })
                }
              }}
            >
              <option value="broadcast">{t('attestations.optBC')}</option>
              <option value="websocket">{t('attestations.optWss')}</option>
            </select>
          </div>
          {transportKind === 'broadcast' ? (
            <Alert>
              <AlertTitle>{t('attestations.bcAlertTitle')}</AlertTitle>
              <AlertDescription className="text-sm space-y-2">
                <p>
                  Solo comparte gossip entre pestañas del <strong>mismo sitio</strong> (mismo protocolo, host y
                  puerto). Si tenés un Vite en <code className="text-xs">:5173</code> y otro en{' '}
                  <code className="text-xs">:5177</code>, son <strong>orígenes distintos</strong>: ahí no verán
                  el mismo canal.
                </p>
                <p>
                  Para unir esas dos PWAs (o una local y una en la red): levantá el relay (
                  <code className="text-xs">npm run relay:yohualli</code> en el puerto 8080), cambiá arriba a{' '}
                  <strong>WebSocket relay</strong>, pegá <code className="text-xs">{DIRECT_RELAY_WS}</code> o el
                  botón <strong>Proxy /__yohualli_relay</strong> (misma URL que esta app + path del proxy de Vite) y
                  pulsá <strong>Conectar gossip</strong> en <strong>ambas</strong> instancias con la misma URL.
                  Con la app en <strong>HTTPS</strong> (p. ej. mkcert), <code className="text-xs">ws://127.0.0.1</code>{' '}
                  está <strong>bloqueado</strong> por el navegador (mixed content): usá{' '}
                  <strong>Proxy /__yohualli_relay</strong> (<code className="text-xs">wss://…/__yohualli_relay</code>
                  ). Sin HTTPS, <code className="text-xs">ws://</code> directo al relay suele bastar.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}
          {transportKind === 'websocket' ? (
            <div className="space-y-2 max-w-xl">
              {typeof window !== 'undefined' && isMixedContentWsOnHttps(relayWsUrl) ? (
                <Alert variant="destructive">
                  <AlertTitle>{t('attestations.mixedTitle')}</AlertTitle>
                  <AlertDescription className="text-sm space-y-2">
                    <p>
                      Esta pestaña carga por <strong>HTTPS</strong>; el navegador no abre <code className="text-xs">ws://</code>{' '}
                      (inseguro). Pulsá <strong>Proxy /__yohualli_relay</strong> abajo: usa <code className="text-xs">wss://</code>{' '}
                      al mismo host que sirve la app; Vite reenvía al relay en el puerto 8080.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={p2pOn}
                      onClick={() => setRelayWsUrl(relayUrlViaViteProxy())}
                    >
                      {t('attestations.fixUseProxy')}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
              {!showWebsocketRelayConfigFields && !isMixedContentWsOnHttps(relayWsUrl) ? (
                <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground space-y-2">
                  <p>{t('attestations.autoConnectBanner')}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUserOpenedRelayConfig(true)
                      setInRelayConfigGrace(false)
                    }}
                  >
                    {t('attestations.showRelayOptions')}
                  </Button>
                </div>
              ) : null}
              {showWebsocketRelayConfigFields ? (
                <>
              <div className="space-y-2">
                <Label htmlFor="relay-ws">{t('attestations.labelRelayUrl')}</Label>
                <p className="text-xs text-muted-foreground font-medium">
                  {t('attestations.relayPresets')}
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                <Input
                  id="relay-ws"
                  className="font-mono text-xs flex-1 min-w-[200px] basis-full sm:basis-auto"
                  placeholder={t('attestations.phRelay')}
                  value={relayWsUrl}
                  disabled={p2pOn}
                  onChange={(e) => setRelayWsUrl(e.target.value)}
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={p2pOn}
                  title="Solo si levantás la app con Vite (dev o preview): el proxy /__yohualli_relay evita mixed content en HTTPS."
                  onClick={() => setRelayWsUrl(relayUrlViaViteProxy())}
                >
                  Proxy /__yohualli_relay
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={p2pOn}
                  onClick={() => setRelayWsUrl(DIRECT_RELAY_WS)}
                >
                  Directo :8080
                </Button>
                {RAILWAY_RELAY_PRESET ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={p2pOn}
                    title={RAILWAY_RELAY_PRESET}
                    onClick={() => setRelayWsUrl(RAILWAY_RELAY_PRESET)}
                  >
                    {t('attestations.relayPresetRailway')}
                  </Button>
                ) : null}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                El relay debe estar en marcha (<code className="text-xs">npm run relay:yohualli</code>). Con{' '}
                <strong>Vite + HTTPS</strong> (mkcert), usá <strong>Proxy /__yohualli_relay</strong> (no{' '}
                <code className="text-xs">ws://127.0.0.1</code>: mixed content). En un build estático sin ese proxy
                (p. ej. solo GitHub Pages), configurá <code className="text-xs">wss://</code> a tu relay. Si{' '}
                <strong>curl</strong> a <code className="text-xs">8080/health</code> funciona pero el WS directo no,
                el proxy también ayuda en vista embebida / port-forward.
              </p>
                </>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('attestations.status')}</span>
              <Badge variant={p2pOn ? 'default' : 'secondary'}>
                {!p2pOn
                  ? t('attestations.gossipOff')
                  : t('attestations.gossipTypeState', {
                      type: transportKind === 'websocket' ? 'WSS' : 'BC',
                      state: gossipNode.connected
                        ? t('attestations.gossipLinkReady')
                        : t('attestations.gossipConnecting'),
                    })}
              </Badge>
            </div>
            <Button
              type="button"
              variant={p2pOn ? 'secondary' : 'default'}
              disabled={!canConnectWs}
              onClick={() => {
                setLastError(null)
                if (!p2pOn && transportKind === 'websocket' && typeof window !== 'undefined') {
                  if (isMixedContentWsOnHttps(relayWsUrl)) {
                    setLastError(t('attestations.mixedContentError'))
                    return
                  }
                }
                setP2pOn((v) => !v)
              }}
            >
              {p2pOn ? t('attestations.disGossip') : t('attestations.conGossip')}
            </Button>
          </div>
          {transportKind === 'websocket' && relayWsUrl.trim() ? (
            <div className="flex flex-wrap gap-2 pt-1 w-full">
              <Button type="button" variant="outline" size="sm" onClick={() => void handleReplayLocalToRelay()}>
                {t('attestations.relayRtf')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!p2pOn}
                onClick={() => handleRelayCatchupFromZero()}
                title="Vuelve a pedir el buffer del relay (afterSeq=0). Útil para el sujeto u otra pestaña; el grafo deduplica por id. Si el socket no está listo, verás un error arriba."
              >
                {t('attestations.catchup')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grafo local</CardTitle>
          <CardDescription>Nodos y aristas derivados de atestaciones Sr25519 verificables.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-center">
          <div className="text-sm">
            <span className="text-muted-foreground">Nodos: </span>
            <strong>{stats?.nodeCount ?? '—'}</strong>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Atestaciones: </span>
            <strong>{stats?.attestationCount ?? '—'}</strong>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshUi()}>
            Actualizar contadores e historial
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => void handleClear()}>
            <Trash2 className="h-4 w-4 mr-1" />
            Vaciar grafo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Historial de atestaciones
          </CardTitle>
          <CardDescription>
            Todas las firmas guardadas en IndexedDB, de la más reciente a la más antigua. La misma pareja
            atestador–sujeto puede repetirse con otro instante (otro id). <strong>Abrir JSON</strong> muestra
            un solo registro con <code className="text-[11px]">attesterAddress</code> (quien firma y
            publica) y <code className="text-[11px]">subjectAddress</code> (quien recibe el enlace; el
            criterio {YOHUALLI_SUBSTRATE_DERIVATION} aplica a ambos nodos, pero al sujeto el cliente no lo
            prueba con solo su SS58). <strong>EIP-712</strong> indica ancla
            <code className="text-[11px]"> YohualliAttestationV0</code> en la fila. La columna Gossip
            (saliente) solo aplica a atestaste con WebSocket. La memoria de envío no sobrevive a recargar la
            página.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attestationHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay atestaciones almacenadas todavía.</p>
          ) : (
            <div className="rounded-md border max-h-[min(420px,50vh)] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Fecha (local)</TableHead>
                    <TableHead>Atestador</TableHead>
                    <TableHead>Sujeto</TableHead>
                    <TableHead>Contexto</TableHead>
                    <TableHead className="text-right">Tier</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-xs">EIP-712</TableHead>
                    <TableHead className="text-center w-[1%]">JSON</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">Gossip (saliente)</TableHead>
                    <TableHead className="font-mono text-xs">Id</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attestationHistory.map((att) => (
                    <TableRow key={att.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {format(new Date(att.timestampMs), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={att.attesterAddress}>
                        {shortSs58(att.attesterAddress)}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={att.subjectAddress}>
                        {shortSs58(att.subjectAddress)}
                      </TableCell>
                      <TableCell className="text-xs max-w-[140px] truncate" title={att.contextId}>
                        {att.contextId}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{att.trustTier}</TableCell>
                      <TableCell className="text-center">
                        {att.eip712V0 ? (
                          <Badge variant="default" className="text-[10px]" title={att.eip712V0.signerAddress}>
                            Sí
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Atestación almacenada: payload completo (gossip/relay/IndexedDB)"
                          onClick={() => setGraphJsonDialogAtt(att)}
                        >
                          <Braces className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs py-2">{renderGossipOutboundCell(att)}</TableCell>
                      <TableCell className="font-mono text-[11px] max-w-[120px] truncate" title={att.id}>
                        {att.id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Protocolo por código QR</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quien pide ser atestado muestra un código generado solo con sus cuentas locales. Quien atesta
            escanea y obtiene el sujeto sin escribirlo a mano, para alinear el acto con una ceremonia
            presencial o virtual. El modo laboratorio permite excepciones solo para pruebas.
          </p>
        </div>
        <AttestationQrPanel
          accounts={accounts.map((a) => ({
            address: a.address,
            name: typeof a.meta?.name === 'string' ? a.meta.name : undefined,
            keypairType: getKeypairType(a.pair),
            dualSubstrateSs58: a.dualSubstrateSs58,
            evmBip44Address: a.evmBip44Address,
          }))}
          requestSubjectAddress={qrRequestAccount}
          onRequestSubjectAddressChange={setQrRequestAccount}
          contextId={contextId}
          trustTier={trustTier}
          onApplyScannedRequest={handleApplyQrRequest}
          keyringUnlocked={isUnlocked}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="h-5 w-5" />
            Crear atestación
          </CardTitle>
          <CardDescription>
            Firma un payload JSON estable; opcionalmente se adjunta la ancla <strong>EIP-712 v0</strong> en
            el mismo registro (IndexedDB y <code className="text-xs">yohualli/v1/attestations</code> hacia
            el relay), usando el epoch de la sección de firma EIP-712 más abajo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cuenta atestadora</Label>
            <RadioGroup value={selectedAttester} onValueChange={setSelectedAttester} className="flex flex-col gap-3">
              {accounts.map((a) => {
                const kt = getKeypairType(a.pair)
                return (
                  <div key={a.address} className="flex items-start gap-2 min-w-0">
                    <RadioGroupItem value={a.address} id={a.address} disabled={!isUnlocked} className="mt-1 shrink-0" />
                    <Label htmlFor={a.address} className="font-normal cursor-pointer min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.meta.name ?? 'Sin nombre'}</span>
                        <Badge variant={keypairTypeBadgeVariant(kt)} className="text-[10px] uppercase tracking-wide">
                          {kt}
                        </Badge>
                      </div>
                      {a.dualSubstrateSs58 ? (
                        <DualSubstrateAddressLines
                          dual={a.dualSubstrateSs58}
                          evmAddress={a.evmBip44Address}
                        />
                      ) : (
                        <div className="font-mono text-[11px] text-muted-foreground break-all">{a.address}</div>
                      )}
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
            {isUnlocked && trustedLabVerification && trustedLabVerification.status !== 'no_config' ? (
              <Alert
                variant={
                  trustedLabVerification.status === 'full'
                    ? 'default'
                    : trustedLabVerification.status === 'mismatch'
                      ? 'destructive'
                      : 'default'
                }
                className={
                  trustedLabVerification.status === 'full'
                    ? 'border-green-600/40 bg-green-500/10'
                    : trustedLabVerification.status === 'substrate_only' ||
                        trustedLabVerification.status === 'evm_only'
                      ? 'border-amber-600/40 bg-amber-500/10'
                      : undefined
                }
              >
                <AlertTitle className="text-sm">Trusted seed (lab / futuro contrato)</AlertTitle>
                <AlertDescription className="text-xs space-y-1">
                  <p>{trustedLabVerification.message}</p>
                  <p className="text-muted-foreground">
                    El grafo usa hoy principalmente SS58; si hay nodos <code className="text-[11px]">0x…</code>, la
                    misma identidad trusted se reconoce por ambas caras. SybilRank usa una sola dirección por
                    identidad para no duplicar masa.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}
            {isUnlocked && selectedAttesterPairType && !isSecp256k1Family(selectedAttesterPairType) ? (
              <Alert>
                <AlertTitle>Criptografía de la cuenta atestadora</AlertTitle>
                <AlertDescription className="text-sm">
                  El grafo y el gossip no dependen de la curva: solo cambian el formato de la firma y el
                  identificador público. Esta cuenta usa <strong>{selectedAttesterPairType}</strong>. Para
                  alinear con el borrador Yohualli 1.1 (secp256k1 unificado), use una cuenta{' '}
                  <strong>ecdsa</strong> (SS58) o <strong>ethereum</strong> del keyring; puede crearla o
                  importarla en Cuentas. La verificación admite sr25519, ed25519, ecdsa y ethereum en el mismo
                  flujo.
                </AlertDescription>
              </Alert>
            ) : null}
            {!isUnlocked ? (
              <p className="text-xs text-amber-600">Keyring bloqueado: desbloquee en Cuentas para firmar.</p>
            ) : null}
            {isUnlocked && !selectedAttesterYohualliSuri.known ? (
              <Alert variant="destructive">
                <AlertTitle>Material de SURI faltante</AlertTitle>
                <AlertDescription className="text-xs">
                  Cuenta importada solo con JSON: no se puede asegurar {YOHUALLI_SUBSTRATE_DERIVATION}. Añadí
                  con frase o SURI bajo Cuentas para atestar o recibir identidad de protocolo en Yohualli.
                </AlertDescription>
              </Alert>
            ) : null}
            {isUnlocked && selectedAttesterYohualliSuri.known && !selectedAttesterYohualliSuri.hasPath ? (
              <Alert variant="destructive">
                <AlertTitle>Ruta Substrate inadecuada</AlertTitle>
                <AlertDescription className="text-xs">
                  Yohualli exige que el material importado en la SURI contenga {YOHUALLI_SUBSTRATE_DERIVATION}.
                  Volvé a añadir la frase/URI; el gestor aplica {YOHUALLI_SUBSTRATE_DERIVATION} a las BIP39 sin
                  ruta explícita.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Sujeto de la atestación (SS58)</Label>
            {subjectLockedFromQr ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Fijado por código QR</Badge>
                  <Button type="button" variant="outline" size="sm" onClick={handleUnlockSubjectFromQr}>
                    Desbloquear sujeto
                  </Button>
                </div>
                <Input
                  id="subject"
                  readOnly
                  className="font-mono text-xs bg-muted/50"
                  value={subjectAddress}
                />
              </div>
            ) : subjectManualLab ? (
              <Input
                id="subject"
                placeholder="Dirección atestada (solo laboratorio)"
                className="font-mono text-xs"
                value={subjectAddress}
                onChange={(e) => setSubjectAddress(e.target.value)}
              />
            ) : (
              <p id="subject" className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                Escanee una solicitud en la sección <strong>Escanear solicitud</strong> y pulse &quot;Aplicar
                al formulario y bloquear sujeto&quot;, o active el modo laboratorio abajo.
              </p>
            )}
          </div>
          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="subject-manual-lab"
                checked={subjectManualLab}
                disabled={subjectLockedFromQr || !isUnlocked}
                onCheckedChange={(c) => {
                  const on = c === true
                  setSubjectManualLab(on)
                  if (!on && !subjectLockedFromQr) setSubjectAddress('')
                }}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="subject-manual-lab" className="cursor-pointer font-medium">
                  Modo laboratorio: editar sujeto sin código QR
                </Label>
                <p className="text-xs text-muted-foreground">
                  Omite el protocolo de solicitud escaneada. Desactivado mientras el sujeto esté bloqueado por
                  un código.
                </p>
              </div>
            </div>
          </div>
            <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ctx">Context ID</Label>
              <Input id="ctx" value={contextId} onChange={(e) => setContextId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier">Trust tier</Label>
              <Input id="tier" type="number" min={0} value={trustTier} onChange={(e) => setTrustTier(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md border p-3 space-y-2 bg-muted/20">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="include-eip712-publish"
                checked={includeEip712OnPublish}
                disabled={
                  !isUnlocked ||
                  !accounts.find((a) => a.address === selectedAttester)?.hdDerivationSuri ||
                  !selectedAttesterYohualliSuri.hasPath
                }
                onCheckedChange={(c) => setIncludeEip712OnPublish(c === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="include-eip712-publish" className="cursor-pointer font-medium">
                  Incluir ancla EIP-712 v0 al publicar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Añade <code className="text-[11px]">eip712V0</code> al mismo objeto que el grafo (gossip/relay);
                  requiere material HD (no solo JSON de Polkadot.js). Usa el <strong>epoch</strong> del bloque
                  de firma EIP-712.
                </p>
              </div>
            </div>
            {isUnlocked &&
            !accounts.find((a) => a.address === selectedAttester)?.hdDerivationSuri ? (
              <p className="text-xs text-amber-700/90 pl-6">
                Sin frase o SURI en el keyring no se puede anclar EIP-712; importar con material de
                derivación bajo Cuentas.
              </p>
            ) : null}
            {isUnlocked && selectedAttesterYohualliSuri.known && !selectedAttesterYohualliSuri.hasPath ? (
              <p className="text-xs text-amber-700/90 pl-6">
                SURI sin {YOHUALLI_SUBSTRATE_DERIVATION}: ajustá Cuentas o añadí otra clave. La ancla EIP-712
                queda deshabilitada hasta alinear.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void handlePublish()}
              disabled={
                !isUnlocked ||
                !selectedAttesterYohualliSuri.known ||
                !selectedAttesterYohualliSuri.hasPath
              }
            >
              {publishLabel}
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleMarkLocal()}>
              Marcar cuenta como nodo local
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSignature className="h-5 w-5" />
            Firma de atestación EIP-712 v0 (PWA, viem)
          </CardTitle>
          <CardDescription>
            Misma convención que{' '}
            <code className="text-[11px]">docs/YOHUALLI_ATTESTATION_SIGNING_V0.md</code>: dominio Yohualli / versión 1 /{' '}
            <code className="text-[11px]">chainId {paseoPassetHub.id}</code> / <code className="text-[11px]">verifyingContract 0x0…0</code> (lab).
            Clave del firmante: <code className="text-[11px]">{YOHUALLI_ATTESTATION_BIP44_PATH}</code> (no MetaMask ni{' '}
            <code className="text-[11px]">m/44&apos;/60&apos;/0&apos;/0/0</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedHdSuri ? (
            <Alert>
              <AlertTitle>Sin material HD en memoria</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>
                  Solo las cuentas cargadas desde <strong>mnemonic</strong>, <strong>SURI</strong> o desbloqueo/WebAuthn
                  con ese formato exponen <code className="text-[11px]">hdDerivationSuri</code> en la sesión. Las
                  importadas únicamente como JSON de Polkadot.js no pueden derivar esta ruta aquí.
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="text-sm space-y-1 rounded-md border p-3 bg-muted/30">
              <div>
                <span className="text-muted-foreground">EOA atestación (derivada): </span>
                <code className="text-[11px] break-all">{yohualliAttestEvmPreview ?? '—'}</code>
              </div>
              <div>
                <span className="text-muted-foreground">schemaId v0 (constante): </span>
                <code className="text-[11px] break-all">{YOHUALLI_ATTESTATION_V0_SCHEMA_ID}</code>
              </div>
            </div>
          )}
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="eip712-epoch">Epoch (uint64, lab)</Label>
            <Input
              id="eip712-epoch"
              className="font-mono text-xs"
              value={eip712EpochSec}
              onChange={(e) => setEip712EpochSec(e.target.value)}
              inputMode="numeric"
            />
            <p className="text-[11px] text-muted-foreground">
              Por defecto segundos UNIX. Debe alinearse con la política del relayer/registro en producción.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={
                !isUnlocked ||
                !selectedHdSuri ||
                eip712SignBusy ||
                !selectedAttesterYohualliSuri.known ||
                !selectedAttesterYohualliSuri.hasPath
              }
              onClick={() => void handleSignYohualliEip712()}
            >
              {eip712SignBusy ? 'Firmando…' : 'Firmar YohualliAttestationV0'}
            </Button>
            {eip712Bundle ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        ...eip712Bundle,
                        contextId: contextId.trim() || 'yohualli-lab',
                        epoch: eip712EpochSec.trim(),
                        chainId: paseoPassetHub.id,
                      },
                      null,
                      2
                    )
                  )
                }
              >
                Copiar JSON
              </Button>
            ) : null}
          </div>
          {eip712Bundle ? (
            <div className="rounded-md border p-3 space-y-2 text-xs font-mono break-all bg-muted/20">
              <div>
                <span className="text-muted-foreground font-sans text-[11px]">subjectCommitment </span>
                {eip712Bundle.subjectCommitment}
              </div>
              <div>
                <span className="text-muted-foreground font-sans text-[11px]">signature </span>
                {eip712Bundle.signature}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vecindario (BFS)</CardTitle>
          <CardDescription>
            Exploración no dirigida alrededor de la cuenta seleccionada (hasta N saltos). El grafo fuerza además
            un <strong>Tier-SybilRank</strong>: semillas implícitas = nodos que emitieron tier ≥ umbral (se relaja
            hasta cubrir el subgrafo); opcionalmente <strong>trusted seeds de lab</strong> (whitelist SS58/EVM en{' '}
            <code className="text-xs">trustedSeedsLab.ts</code> o <code className="text-xs">VITE_LAB_TRUSTED_*</code>
            ); la cuenta del centro recibe un refuerzo de masa. Sin registro on-chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-2">
              <Label htmlFor="depth">Profundidad</Label>
              <Input
                id="depth"
                className="w-24"
                value={hoodDepth}
                onChange={(e) => setHoodDepth(e.target.value)}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => void handleNeighborhood()}>
              Calcular vecindario
            </Button>
          </div>
          {hood ? (
            <div className="text-sm space-y-1 rounded-md border p-3 bg-muted/30">
              <div>
                <span className="text-muted-foreground">Nodos alcanzados: </span>
                {hood.nodeIds.length}
              </div>
              <div>
                <span className="text-muted-foreground">Aristas en subgrafo: </span>
                {hood.attestations.length}
              </div>
              {tierSybilMeta ? (
                <div>
                  <span className="text-muted-foreground">Tier-SybilRank: </span>
                  umbral de semilla implícita tier ≥ <strong>{tierSybilMeta.thresholdUsed}</strong>,{' '}
                  <strong>{tierSybilMeta.seedCount}</strong> semilla(s) por tier; trusted lab en este subgrafo:{' '}
                  <strong>{tierSybilMeta.trustedLabHit}</strong>. Pase el cursor en el grafo para ver el % por nodo.
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitBranch className="h-5 w-5" />
            Visualización del grafo
          </CardTitle>
          <CardDescription>
            Mismo subgrafo que “Vecindario”: layout forzado 2D (react-force-graph). Flechas atestador → sujeto.
            Grosor ≈ peso de lab (frescura × tier); color mezcla saltos desde el centro y Tier-SybilRank; violeta =
            centro. Tooltip: SS58, saltos, grado y % Tier-SybilRank.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!vizData || vizData.nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Calcule el vecindario arriba para generar la vista (emplee la cuenta seleccionada y la profundidad).
            </p>
          ) : (
            <SocialGraphForceView data={vizData} />
          )}
        </CardContent>
      </Card>

      <Dialog open={graphJsonDialogAtt !== null} onOpenChange={(o) => !o && setGraphJsonDialogAtt(null)}>
        <DialogContent className="max-w-[min(100vw,40rem)] max-h-[min(90vh,720px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registro de atestación (almacenado / reenviado tal cual)</DialogTitle>
            <DialogDescription className="text-left text-xs">
              Misma carga usada en IndexedDB y (si conectaste gossip) hacia el relay.{' '}
              <code className="text-[11px]">attesterAddress</code>: nodo atestador (manda).{' '}
              <code className="text-[11px]">subjectAddress</code>: nodo sujeto (recibe el enlace; conviene que
              haya creado su cuenta con SURI bajo {YOHUALLI_SUBSTRATE_DERIVATION} en su PWA, no comprobable aquí).
            </DialogDescription>
          </DialogHeader>
          {graphJsonDialogAtt ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    void navigator.clipboard.writeText(JSON.stringify(graphJsonDialogAtt, null, 2))
                  }
                >
                  Copiar
                </Button>
              </div>
              <pre className="text-[11px] leading-relaxed p-3 rounded-md border bg-muted/40 overflow-x-auto max-h-[min(55vh,480px)]">
                {JSON.stringify(graphJsonDialogAtt, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
