import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Cpu, ExternalLink, FlaskConical, FolderOpen, Link2, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { honkVerifierAbi } from '@/circuits/honkVerifierAbi'
import { yohualliMerkleHonkRegistryAbi } from '@/circuits/yohualliGatewayAbi'
import { normalizeHexProof, packMerkleFrToBytes32, parsePublicInputsLines } from '@/circuits/encodeProof'
import { KUSAMA_NOIR_LAB_PATH, loadSquareSampleFromPublic } from '@/circuits/kusamaNoirLabSample'
import { loadYohualliOneAttestSampleFromEmbeds } from '@/circuits/yohualliOneAttestLabSample'
import {
  loadYohualliMerkleAttestV1SampleFromEmbeds,
  YOHUALLI_MERKLE_ATTEST_V1_MERKLE_FR_START,
} from '@/circuits/yohualliMerkleAttestV1LabSample'
import type { YohualliMerkleV1ProveLabSuccess } from '@/circuits/yohualliMerkleV1ProveCore'
import { runMerkleV1ProveLabInMainThread } from '@/circuits/yohualliMerkleV1MainThreadClient'
import { runMerkleV1ProveLabInWorker } from '@/circuits/yohualliMerkleV1WorkerClient'
import type { YohualliSubjectCommitmentV0ProveLabSuccess } from '@/circuits/yohualliSubjectCommitmentV0ProveCore'
import { runSubjectCommitmentV0ProveLabInMainThread } from '@/circuits/yohualliSubjectCommitmentV0MainThreadClient'
import { runSubjectCommitmentV0ProveLabInWorker } from '@/circuits/yohualliSubjectCommitmentV0WorkerClient'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { usePaseoEvmWallet } from '@/hooks/usePaseoEvmWallet'
import { paseoPassetHub } from '@/config/paseoEvm'
import type { Address, Hex } from 'viem'
import { formatEther, isAddress } from 'viem'
import { decodeErrorResult } from 'viem'
import {
  formatProveLabErrorForUi,
  zkLabMerkleErrorSuffix,
  zkLabVitePortHintIfRelevant,
} from '@/utils/formatProveLabErrorForUi'

const defaultVerifier =
  (import.meta.env.VITE_PASEO_VERIFIER_ADDRESS as Address | undefined) ?? undefined
const defaultMerkleRegistry =
  (import.meta.env.VITE_PASEO_MERKLE_REGISTRY_ADDRESS as Address | undefined) ?? undefined

/** Convierte revert on-chain (Honk o registry) en mensaje con pista v0/v1. */
function formatOnChainVerifyError(
  e: unknown,
  nPublicInputs: number,
  source: 'honk' | 'registry',
): string {
  let base = e instanceof Error ? e.message : String(e)
  const d = (e as { data?: `0x${string}`; cause?: { data?: `0x${string}` } })?.data
    ?? (e as { cause?: { data?: `0x${string}` } })?.cause?.data
  if (d && d.length >= 10) {
    for (const abi of [honkVerifierAbi, yohualliMerkleHonkRegistryAbi] as const) {
      try {
        const dec = decodeErrorResult({ abi, data: d })
        base = `${(dec as { errorName: string }).errorName}()`
        break
      } catch {
        // probar siguiente ABI
      }
    }
  }
  const isLenWrong =
    base.includes('PublicInputsLengthWrong') || (d && d.slice(0, 10).toLowerCase() === '0xfa066593')
  if (isLenWrong) {
    if (nPublicInputs === 128) {
      return `${base} — Causa habitual: "Contrato verificador" apunta a un Honk cuya VK exige otra longitud (p. ej. v0 con 96 públicos, no 128 de yohualli_merkle_attest_v1). Sincronizá con \`verifier:sync:honk:merkle-v1\`, fijá el registry con setHonkVerifier, y usá "Aplicar .env" o reimportá la muestra Merkle v1; reiniciá el dev server si cambiaste VITE.`
    }
    if (nPublicInputs === 96) {
      return `${base} — Si usás yohualli_merkle_attest_v1 (128), pasá 128 filas; si el Honk es v0, usá yohualli_one_attest_sig y 96.`
    }
  }
  if (
    source === 'registry' &&
    !base.includes('el root empaquetado') &&
    (base.includes('MerkleRootMismatch()') || d?.toLowerCase().includes('0432f01c'))
  ) {
    return `${base} — Empaquetado = pack de 32 Fr (byte bajo) desde publicInputs[merkleFieldStart…]. Alinea setMerkleRoot(epoch) con el root de la prueba; merkle v1: merkleFieldStart=96, 128 filas totales.`
  }
  return base
}

/**
 * Laboratorio ZK: pegar prueba + públicos generados con `nargo`/`bb` para el **mismo** circuito que el
 * `HonkVerifier` desplegado, o la muestra *square* (solo si ese contrato cuadra con el circuito square).
 */
export default function ZkLab() {
  const { t } = useTranslation('pages')
  const {
    address,
    publicClient,
    hasInjectedProvider,
    connect,
    connectError,
    nativePasWei,
    nativePasLoading,
    nativePasError,
    refetchNativePasBalance,
  } = usePaseoEvmWallet()
  const { activeAccountAddress } = useKeyringContext()

  const applyVitePaseoAddresses = () => {
    if (defaultVerifier) {
      setVerifierAddr(defaultVerifier)
    }
    if (defaultMerkleRegistry) {
      setRegistryAddr(defaultMerkleRegistry)
    }
  }
  const hasVitePaseoAddresses = Boolean(defaultVerifier || defaultMerkleRegistry)

  const [verifierAddr, setVerifierAddr] = useState<string>(defaultVerifier ?? '')
  const [registryAddr, setRegistryAddr] = useState<string>(defaultMerkleRegistry ?? '')
  const [merkleEpoch, setMerkleEpoch] = useState<string>('0')
  const [merkleFieldStart, setMerkleFieldStart] = useState<string>(
    String(YOHUALLI_MERKLE_ATTEST_V1_MERKLE_FR_START)
  )
  const [proofHex, setProofHex] = useState('')
  const [publicInputsText, setPublicInputsText] = useState('')
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sampleLoading, setSampleLoading] = useState(false)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const [onchainRootPreview, setOnchainRootPreview] = useState<string | null>(null)
  const [pageOrigin, setPageOrigin] = useState<string | null>(null)
  useEffect(() => {
    setPageOrigin(typeof window !== 'undefined' ? window.location.origin : null)
  }, [])

  const showIosProveHint =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Mobile.*Safari/i.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(navigator.userAgent)
  /** null = inactivo; de lo contrario qué prover corre (bloquea el otro botón). */
  const [proveMode, setProveMode] = useState<null | 'worker' | 'main'>(null)
  const [proveWorkerError, setProveWorkerError] = useState<string | null>(null)
  const [proveWorkerLog, setProveWorkerLog] = useState<string[] | null>(null)
  const [proveWorkerStats, setProveWorkerStats] = useState<{
    totalMs: number
    proveMs: number
    n: number
  } | null>(null)
  const [merkleProveTranscript, setMerkleProveTranscript] = useState<'keccak' | 'poseidon2' | null>(null)

  /** prover *subject commitment* (circuito distinto a Merkle v1). */
  const [scProveMode, setScProveMode] = useState<null | 'worker' | 'main'>(null)
  const [scProveError, setScProveError] = useState<string | null>(null)
  const [scProveLog, setScProveLog] = useState<string[] | null>(null)
  const [scProveStats, setScProveStats] = useState<{
    totalMs: number
    proveMs: number
    n: number
  } | null>(null)
  /** `poseidon2` si el prover reintenta sin transcript keccak (ver `bbProveWithTranscriptFallback.ts`). */
  const [scProveTranscript, setScProveTranscript] = useState<'keccak' | 'poseidon2' | null>(null)

  const proveBusy = proveMode !== null || scProveMode !== null

  const applyMerkleProveSuccess = (r: YohualliMerkleV1ProveLabSuccess) => {
    setProofHex(r.proofHex)
    setPublicInputsText(r.publicInputsText)
    setMerkleFieldStart(String(YOHUALLI_MERKLE_ATTEST_V1_MERKLE_FR_START))
    setProveWorkerLog(r.logLines)
    setProveWorkerStats({
      totalMs: r.totalMs,
      proveMs: r.proveMs,
      n: r.publicInputCount,
    })
    setMerkleProveTranscript(r.proofTranscript ?? null)
    if (defaultVerifier) {
      setVerifierAddr(defaultVerifier)
    }
    if (defaultMerkleRegistry) {
      setRegistryAddr(defaultMerkleRegistry)
    }
  }

  const applySubjectCommitmentProveSuccess = (r: YohualliSubjectCommitmentV0ProveLabSuccess) => {
    setProofHex(r.proofHex)
    setPublicInputsText(r.publicInputsText)
    setScProveLog(r.logLines)
    setScProveStats({ totalMs: r.totalMs, proveMs: r.proveMs, n: r.publicInputCount })
    setScProveTranscript(r.proofTranscript ?? null)
  }

  const runOnChainVerify = async () => {
    setVerifyError(null)
    setVerifyResult(null)
    setOnchainRootPreview(null)
    setLoading(true)
    try {
      if (!verifierAddr.trim() || !isAddress(verifierAddr as Hex)) {
        throw new Error('Indique una dirección de contrato HonkVerifier válida (0x…).')
      }
      const proof = normalizeHexProof(proofHex)
      const publicInputs = parsePublicInputsLines(publicInputsText) as readonly Hex[]

      const ok = await publicClient.readContract({
        address: verifierAddr as Address,
        abi: honkVerifierAbi,
        functionName: 'verify',
        args: [proof, publicInputs],
      })
      setVerifyResult(ok)
    } catch (e) {
      const n = parsePublicInputsLines(publicInputsText).length
      setVerifyError(formatOnChainVerifyError(e, n, 'honk'))
    } finally {
      setLoading(false)
    }
  }

  const runVerifyForEpoch = async () => {
    setVerifyError(null)
    setVerifyResult(null)
    setOnchainRootPreview(null)
    setLoading(true)
    try {
      if (!registryAddr.trim() || !isAddress(registryAddr as Hex)) {
        throw new Error('Indique YohualliMerkleHonkRegistry (0x…), o VITE_PASEO_MERKLE_REGISTRY_ADDRESS en build.')
      }
      const proof = normalizeHexProof(proofHex)
      const publicInputs = parsePublicInputsLines(publicInputsText) as readonly Hex[]
      const epoch = BigInt(merkleEpoch.trim() || '0')
      const start = BigInt(merkleFieldStart.trim() || '0')

      const root = await publicClient.readContract({
        address: registryAddr as Address,
        abi: yohualliMerkleHonkRegistryAbi,
        functionName: 'merkleRoot',
        args: [epoch],
      })
      setOnchainRootPreview(root as string)

      const startN = Number(start)
      if (!Number.isSafeInteger(startN) || startN < 0) {
        throw new Error('merkleFieldStart debe ser un entero no negativo (p. ej. 96 para yohualli_merkle_attest_v1).')
      }
      const packed = packMerkleFrToBytes32(publicInputs, startN)
      const onChain = (root as string).toLowerCase() as `0x${string}`
      if (packed.toLowerCase() !== onChain) {
        throw new Error(
          `MerkleRootMismatch (0x0432f01c): el root empaquetado desde publicInputs[${startN}…${
            startN + 31
          }] = ${packed} no coincide con merkleRoot(${epoch.toString()}) = ${onChain}. Revisá que haya exactamente 128 filas (v1), el mismo setMerkleRoot y epoch, y que merkleFieldStart sea 96 para ese circuito.`
        )
      }

      const ok = await publicClient.readContract({
        address: registryAddr as Address,
        abi: yohualliMerkleHonkRegistryAbi,
        functionName: 'verifyForEpoch',
        args: [epoch, proof, publicInputs, start],
      })
      setVerifyResult(ok)
    } catch (e) {
      const n = parsePublicInputsLines(publicInputsText).length
      setVerifyError(formatOnChainVerifyError(e, n, 'registry'))
    } finally {
      setLoading(false)
    }
  }

  const loadKusamaNoirLabSquareSample = async () => {
    setSampleError(null)
    setVerifyResult(null)
    setVerifyError(null)
    setSampleLoading(true)
    try {
      const { proofHex: p, publicInputsText: pi } = await loadSquareSampleFromPublic()
      setProofHex(p)
      setPublicInputsText(pi)
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : String(e))
    } finally {
      setSampleLoading(false)
    }
  }

  /** yohualli_merkle_attest_v1: 128 filas; merkle = subjectCommitment v0 del trusted seed (lab) salvo `VITE_YOHUALLI_LAB_MERKLE_ROOT`; 96 = inicio de 32 Fr. */
  const loadYohualliMerkleAttestV1Sample = async () => {
    setSampleError(null)
    setVerifyResult(null)
    setVerifyError(null)
    setOnchainRootPreview(null)
    setSampleLoading(true)
    try {
      const { proofHex: p, publicInputsText: pi } = await loadYohualliMerkleAttestV1SampleFromEmbeds()
      setProofHex(p)
      setPublicInputsText(pi)
      setMerkleFieldStart(String(YOHUALLI_MERKLE_ATTEST_V1_MERKLE_FR_START))
      if (defaultVerifier) {
        setVerifierAddr(defaultVerifier)
      }
      if (defaultMerkleRegistry) {
        setRegistryAddr(defaultMerkleRegistry)
      }
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : String(e))
    } finally {
      setSampleLoading(false)
    }
  }

  /** Misma prueba y mismos `public_inputs` (96 filas) de una corrida de `bb prove` — alineado con el HonkVerifier de este repo. */
  const loadYohualliOneAttestSample = async () => {
    setSampleError(null)
    setVerifyResult(null)
    setVerifyError(null)
    setOnchainRootPreview(null)
    setSampleLoading(true)
    try {
      const { proofHex: p, publicInputsText: pi } = await loadYohualliOneAttestSampleFromEmbeds()
      setProofHex(p)
      setPublicInputsText(pi)
      if (defaultVerifier) {
        setVerifierAddr(defaultVerifier)
      }
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : String(e))
    } finally {
      setSampleLoading(false)
    }
  }

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t('zkLab.title')}</h1>
        </div>
        <p className="text-muted-foreground">
          <Trans
            i18nKey="pages:zkLab.intro"
            values={{ id: paseoPassetHub.id }}
            components={[<strong key="ph" />]}
            ns="pages"
          />
        </p>
        <Alert className="mt-3 border bg-muted/40">
          <FlaskConical className="h-4 w-4" />
          <AlertTitle className="text-sm">{t('zkLab.whoTitle')}</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            <Trans
              i18nKey="pages:zkLab.whoBody"
              components={[
                <code className="text-[10px]" key="0" />,
                <code className="text-[10px]" key="1" />,
                <em key="2" />,
                <code className="text-[10px]" key="3" />,
              ]}
            />
          </AlertDescription>
        </Alert>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>{t('zkLab.flowTitle')}</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
            <div className="leading-relaxed">
            <Badge variant="secondary">1</Badge> {t('zkLab.flow1')}
          </div>
          <div className="leading-relaxed">
            <Badge variant="secondary">2</Badge> {t('zkLab.flow2')}
          </div>
          <div className="leading-relaxed">
            <Badge variant="secondary">3</Badge> {t('zkLab.flow3')}
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t('zkLab.linksTitle')}
          </CardTitle>
          <CardDescription>{t('zkLab.linksDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href={paseoPassetHub.blockExplorers.default.url}
              target="_blank"
              rel="noreferrer"
            >
              Blockscout <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://paseo.site/" target="_blank" rel="noreferrer">
              Paseo Network <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://github.com/paseo-network" target="_blank" rel="noreferrer">
              paseo-network <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('zkLab.evmTitle')}</CardTitle>
          <CardDescription>
            {t('zkLab.evmDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasInjectedProvider && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <Trans
                i18nKey="pages:zkLab.noEthereum"
                components={[<code className="text-xs" key="w" />]}
              />
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void connect()} disabled={!hasInjectedProvider}>
              {t('zkLab.connectWallet')}
            </Button>
            {address && (
              <span className="text-sm font-mono text-muted-foreground break-all">{address}</span>
            )}
          </div>
          {address && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">{t('zkLab.pasLabel')}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void refetchNativePasBalance()}
                  disabled={nativePasLoading}
                >
                  {nativePasLoading ? '…' : t('zkLab.refresh')}
                </Button>
              </div>
              {nativePasLoading ? (
                <p className="font-mono text-muted-foreground">Cargando…</p>
              ) : nativePasError ? (
                <p className="text-destructive text-xs">{nativePasError}</p>
              ) : nativePasWei !== null ? (
                <p className="font-medium tabular-nums">
                  {formatEther(nativePasWei)} <span className="text-muted-foreground">PAS</span>
                </p>
              ) : null}
            </div>
          )}
          {connectError && <p className="text-sm text-destructive">{connectError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Prover Merkle v1 (navegador, Web Worker)
          </CardTitle>
          <CardDescription className="space-y-2">
            {showIosProveHint && (
              <p className="text-sm text-amber-800 dark:text-amber-200/80 border-l-2 border-amber-500/40 pl-2">
                <strong>Safari en iOS:</strong> el prove pide mucha RAM; la pestaña puede recargarse si el sistema
                mata el proceso. Dejá el iPhone conectado, cerrá otras apps y, si se repite, usá{' '}
                <strong>Generar en hilo principal</strong>. Mientras dura, se pide que la pantalla no se apague
                (wake lock) automáticamente.
              </p>
            )}
            <p>
              <code className="text-xs">yohualli_merkle_attest_v1</code> con Noir + Barretenberg (WASM), <code className="text-xs">verifierTarget: evm</code>{' '}
              (transcript keccak para EVM; distinto de <code className="text-xs">keccak: true</code>, que fuerza <code className="text-xs">disableZk</code> en{' '}
              <code className="text-xs">@aztec/bb.js</code> y en WASM suele romper con *Length is too large* / bigfield). Alineá{' '}
              <code className="text-xs">bb prove -t evm</code> / <code className="text-xs">bb write_solidity_verifier</code> a la misma
              familia de ajustes. Primer arranque descarga SRS (puede tardar minutos en móviles con poca RAM). <code className="text-xs">BackendType.Wasm</code> (sin
              sub-worker interno de <code className="text-xs">bb.js</code>).
            </p>
            <p>
              <strong>Distinto</strong> del bloque de abajo (*subject commitment* v0): no es el mismo <code className="text-xs">.json</code> de circuito, solo
              comparte el runtime. Si aún falla, revisá caché / msgpack: <code className="text-xs">yarn dev</code> y consola
              <code className="text-xs">[Vite] @aztec/bb.js msgpack scratch: … MiB</code> (<code className="text-xs">BB_MSGPACK_VITE_MIB</code>).
            </p>
            <p className="text-amber-800 dark:text-amber-200/90">
              <strong>Importante:</strong> abrí el lab con la <strong>misma URL que imprime</strong> <code className="text-xs">yarn dev</code>{' '}
              (p. ej. <code className="text-xs">https://127.0.0.1:5177/zk-lab</code> o la IP LAN; el puerto no es siempre 5173). No uses solo
              la <strong>vista embebida</strong> del IDE (p. ej. <code className="text-xs">https://localhost:64926/…</code>
              {pageOrigin && pageOrigin.includes('64926') && (
                <span>
                  {' '}
                  — ahora estás en <code className="text-xs break-all">{pageOrigin}</code>
                </span>
              )}
              ): a veces da <code className="text-xs">ERR_EMPTY_RESPONSE</code> o rompe carga de WASM; si el worker falla con
              *Length is too large*, usá <strong>Generar en hilo principal</strong> o abrí en el origen “real” del Vite
              {pageOrigin && !pageOrigin.includes('64926') && (
                <span>
                  : <code className="text-xs break-all">{pageOrigin}/zk-lab</code>
                </span>
              )}
              .
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setProveWorkerError(null)
                setProveWorkerLog(null)
                setProveWorkerStats(null)
                setMerkleProveTranscript(null)
                setProveMode('worker')
                void runMerkleV1ProveLabInWorker().then((r) => {
                  setProveMode(null)
                  if (r.ok) {
                    applyMerkleProveSuccess(r)
                  } else {
                    setProveWorkerError(
                      formatProveLabErrorForUi(r.message, r.stack) + zkLabMerkleErrorSuffix(r.message, 'worker'),
                    )
                  }
                })
              }}
              disabled={proveBusy}
            >
              {proveMode === 'worker'
                ? 'Generando prueba (worker)…'
                : 'Generar prueba (Merkle v1) en Web Worker'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setProveWorkerError(null)
                setProveWorkerLog(null)
                setProveWorkerStats(null)
                setMerkleProveTranscript(null)
                setProveMode('main')
                void runMerkleV1ProveLabInMainThread().then((r) => {
                  setProveMode(null)
                  if (r.ok) {
                    applyMerkleProveSuccess(r)
                  } else {
                    setProveWorkerError(
                      formatProveLabErrorForUi(r.message, r.stack) + zkLabMerkleErrorSuffix(r.message, 'main'),
                    )
                  }
                })
              }}
              disabled={proveBusy}
            >
              {proveMode === 'main'
                ? 'Generando prueba (hilo principal)…'
                : 'Generar en hilo principal (misma lógica, congela la UI)'}
            </Button>
            {proveWorkerStats && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {proveWorkerStats.n} públicos — total {proveWorkerStats.totalMs.toFixed(0)} ms (prove {proveWorkerStats.proveMs.toFixed(0)} ms)
                {merkleProveTranscript === 'poseidon2' && (
                  <span className="ml-1 text-amber-800 dark:text-amber-200/90"> (transcript poseidon2, no EVM keccak)</span>
                )}
              </span>
            )}
          </div>
          {proveWorkerError && <p className="text-sm text-destructive whitespace-pre-wrap">{proveWorkerError}</p>}
          {proveWorkerLog && proveWorkerLog.length > 0 && (
            <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto max-h-40">{proveWorkerLog.join('\n')}</pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Prover subject commitment v0 (PWA, Worker o hilo principal)
          </CardTitle>
          <CardDescription className="space-y-2">
            <p>
              Circuito <code className="text-xs">yohualli_subject_commitment_v0</code>: prueba apertura de{' '}
              <code className="text-xs">subjectCommitment = keccak256(0x01 || pk)</code> (misma v0 que EIP-712), con{' '}
              <code className="text-xs">pk</code> privado (32 B Substrate) y <strong>32 públicos</strong> (el hash).
              Sin ECDSA in-circuit; adecuado para medir prover y Honk ligeros en PWA.
            </p>
            <p>
              Sujeto: la <strong>cuenta activa</strong> de la PWA (SS58 en el keyring) si está definida; si no,{' '}
              <code className="text-xs">VITE_YOHUALLI_LAB_SUBJECT_SS58</code> o el primer SS58 de trusted seeds. No hace
              falta desbloquear: solo hace falta el SS58 público. La verificación on-chain requiere un{' '}
              <code className="text-xs">HonkVerifier</code> <strong>generado para este</strong> circuito; el de Merkle v1 (128
              filas) <strong>no</strong> coincide. Desplegá con <code className="text-xs">bb write_solidity_verifier</code> a
              partir de este <code className="text-xs">.json</code> o comprobá <em>n</em> = 32 filas en <em>Verificar</em>.
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setScProveError(null)
                setScProveLog(null)
                setScProveStats(null)
                setScProveTranscript(null)
                setScProveMode('worker')
                void runSubjectCommitmentV0ProveLabInWorker({
                  subjectSs58: activeAccountAddress ?? undefined,
                }).then((r) => {
                  setScProveMode(null)
                  if (r.ok) {
                    applySubjectCommitmentProveSuccess(r)
                  } else {
                    setScProveError(
                      formatProveLabErrorForUi(r.message, r.stack) + zkLabVitePortHintIfRelevant(),
                    )
                  }
                })
              }}
              disabled={proveBusy}
            >
              {scProveMode === 'worker'
                ? 'Generando (subject, worker)…'
                : 'Generar apertura subject (Web Worker)'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setScProveError(null)
                setScProveLog(null)
                setScProveStats(null)
                setScProveTranscript(null)
                setScProveMode('main')
                void runSubjectCommitmentV0ProveLabInMainThread({
                  subjectSs58: activeAccountAddress ?? undefined,
                }).then((r) => {
                  setScProveMode(null)
                  if (r.ok) {
                    applySubjectCommitmentProveSuccess(r)
                  } else {
                    setScProveError(formatProveLabErrorForUi(r.message, r.stack))
                  }
                })
              }}
              disabled={proveBusy}
            >
              {scProveMode === 'main' ? 'Generando (hilo principal)…' : 'Generar en hilo principal'}
            </Button>
            {scProveStats && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {scProveStats.n} púb. — {scProveStats.totalMs.toFixed(0)} ms (prove {scProveStats.proveMs.toFixed(0)} ms)
                {scProveTranscript === 'poseidon2' && (
                  <span className="ml-1 text-amber-800 dark:text-amber-200/90"> (transcript poseidon2)</span>
                )}
              </span>
            )}
          </div>
          {scProveTranscript === 'poseidon2' && (
            <p className="text-xs text-amber-800 dark:text-amber-200/90">
              La rama <code className="text-[10px]">evm</code> (transcript keccak) en @aztec/bb.js (WASM) falló; se generó prueba con{' '}
              <code className="text-[10px]">poseidon2</code>. <strong>No</strong> usar <code className="text-[10px]">verify</code> Honk+EVM+keccak
              desplegado: para on-chain, <code className="text-[10px]">bb prove -t evm</code> o actualizar bb.
            </p>
          )}
          {scProveError && <p className="text-sm text-destructive whitespace-pre-wrap">{scProveError}</p>}
          {scProveLog && scProveLog.length > 0 && (
            <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto max-h-32">{scProveLog.join('\n')}</pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('zkLab.verifyTitle')}</CardTitle>
          <CardDescription>
            <code className="text-xs">VITE_PASEO_VERIFIER_ADDRESS</code> (Honk) y, para el registro,{' '}
            <code className="text-xs">VITE_PASEO_MERKLE_REGISTRY_ADDRESS</code>.{' '}
            <strong>v1 (recomendado):</strong> <code className="text-xs">yohualli_merkle_attest_v1</code> — 128 filas;{' '}
            <code className="text-xs">verify</code> solo Honk; <code className="text-xs">verifyForEpoch</code> compara el root
            on-chain con 32 filas de públicos desde <code className="text-xs">merkleFieldStart=96</code>.{' '}
            <strong>v0</strong> (96 filas): <code>yohualli_one_attest_sig</code> (sin <code>merkle_root</code> en el circuito). Muestra <em>square</em>
            : otro circuito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => void loadYohualliMerkleAttestV1Sample()}
                disabled={sampleLoading}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                {sampleLoading ? 'Cargando…' : 'Cargar muestra Yohualli Merkle v1 (128 filas)'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Circuito <code className="text-xs">yohualli_merkle_attest_v1</code> + verificador actual del repo. Root de lab:{' '}
                <code className="text-xs">merkle root</code> (32 B) alineado a{' '}
                <code className="text-xs">labTrustedSeedMerkleRootV0</code> / <code className="text-xs">merkle:root:trusted-seed-leaves</code>;
                fijá el mismo con <code className="text-xs">setMerkleRoot(epoch,·root)</code>{' '}
                antes de <code className="text-xs">verifyForEpoch</code>.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadYohualliOneAttestSample()}
                disabled={sampleLoading}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                {sampleLoading ? 'Cargando…' : 'Muestra ECDSA v0 (96 filas, sin merkle)'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Solo si desplegaste un Honk de <code className="text-xs">yohualli_one_attest_sig</code> (no el v1 Merkle del repo).
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void loadKusamaNoirLabSquareSample()}
                disabled={sampleLoading}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                {sampleLoading ? 'Cargando…' : 'Cargar prueba square (otro circuito)'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Circuito <em>square</em> — no usar con el HonkVerifier Yohualli desplegado en esta testnet.
              </span>
            </div>
          </div>
          {sampleError && (
            <p className="text-sm text-destructive whitespace-pre-wrap">{sampleError}</p>
          )}
          <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <Label htmlFor="verifier">Contrato verificador</Label>
              {hasVitePaseoAddresses && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={applyVitePaseoAddresses}
                >
                  Aplicar .env (VITE_PASEO_VERIFIER y registry)
                </Button>
              )}
            </div>
            {defaultVerifier && (
              <p className="text-xs text-muted-foreground break-all">
                <span className="font-medium">Desde .env (Honk):</span> <code className="text-xs">{defaultVerifier}</code>
              </p>
            )}
            <Input
              id="verifier"
              placeholder="0x…"
              value={verifierAddr}
              onChange={(e) => setVerifierAddr(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proof">Prueba (hex, salida de bb: archivo proof)</Label>
            <Textarea
              id="proof"
              className="font-mono text-xs min-h-[100px]"
              placeholder="0x… (hex completo del binario proof)"
              value={proofHex}
              onChange={(e) => setProofHex(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pubs">Public inputs (un bytes32 por línea)</Label>
            <Textarea
              id="pubs"
              className="font-mono text-xs min-h-[80px]"
              placeholder={'Ej. circuito square (y=9):\n0x0000000000000000000000000000000000000000000000000000000000000009'}
              value={publicInputsText}
              onChange={(e) => setPublicInputsText(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Button type="button" onClick={() => void runOnChainVerify()} disabled={loading}>
              {loading ? 'Verificando…' : 'verify → HonkVerifier (eth_call)'}
            </Button>
          </div>
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <p className="text-sm font-medium">Con registro Merkle (misma prueba y públicos)</p>
            <p className="text-xs text-muted-foreground">
              Asegurá <code className="text-xs">YOHUALLI_LAB_MERKLE_ROOT</code> en prover o{' '}
              <code>setMerkleRoot</code> con el <code>MERKLE_ROOT</code> de <code>npm run merkle:root:trusted-seed-leaves</code> (1 hoja) y
              el <code>epoch</code> elegido.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="registry">MerkleHonkRegistry</Label>
                <Input
                  id="registry"
                  placeholder="0x…"
                  className="font-mono text-xs"
                  value={registryAddr}
                  onChange={(e) => setRegistryAddr(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="epoch">Epoch (uint256)</Label>
                <Input
                  id="epoch"
                  className="font-mono text-xs"
                  value={merkleEpoch}
                  onChange={(e) => setMerkleEpoch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mstart">merkleFieldStart (p. ej. 96 v1)</Label>
              <Input
                id="mstart"
                className="font-mono text-xs max-w-xs"
                value={merkleFieldStart}
                onChange={(e) => setMerkleFieldStart(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void runVerifyForEpoch()}
              disabled={loading}
            >
              {loading ? 'Verificando…' : 'verifyForEpoch (registry + alinear root on-chain)'}
            </Button>
            {onchainRootPreview && (
              <p className="text-xs text-muted-foreground break-all">
                <span className="font-medium">merkleRoot(epoch) leído:</span> {onchainRootPreview}
              </p>
            )}
          </div>
          {verifyError && (
            <p className="text-sm text-destructive whitespace-pre-wrap">{verifyError}</p>
          )}
          {verifyResult !== null && (
            <p className="text-sm font-medium">
              Resultado:{' '}
              {verifyResult ? (
                <span className="text-green-600 dark:text-green-400">válida</span>
              ) : (
                <span className="text-destructive">inválida</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Siguiente: transacciones con estado</CardTitle>
          <CardDescription>
            Despliegue un contrato que exponga p. ej.{' '}
            <code className="text-xs">function commit(bytes proof, bytes32[] pubs) external</code> con{' '}
            <code className="text-xs">require(verifier.verify(proof, pubs))</code> y lógica propia. Desde esta
            pantalla se podrá usar <code className="text-xs">walletClient.writeContract</code> con la wallet
            ya conectada.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
