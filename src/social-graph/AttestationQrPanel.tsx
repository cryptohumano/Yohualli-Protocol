import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { decodeAddress } from '@polkadot/util-crypto'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { keypairTypeBadgeVariant } from '@/utils/keyringDisplay'
import { DualSubstrateAddressLines } from '@/components/DualSubstrateAddressLines'
import { Camera, QrCode, ScanLine } from 'lucide-react'
import {
  buildAttestationQrString,
  parseAttestationQrString,
  YOHUALLI_ATTESTATION_QR_KIND,
  type AttestationQrV1Payload,
} from '@/social-graph/attestationQrPayload'
import type { DualSubstrateSs58 } from '@/utils/substrateDualSs58'

const QR_READER_DOM_ID = 'attestation-qr-reader-region'

export type QrAccountOption = {
  address: string
  name?: string
  keypairType?: string
  dualSubstrateSs58?: DualSubstrateSs58
  evmBip44Address?: string
}

export type AttestationQrPanelProps = {
  /** Cuentas locales: solo una de ellas puede ser el sujeto del código (quien pide ser atestado). */
  accounts: QrAccountOption[]
  /** Dirección SS58 de la cuenta propia que aparece en el QR como `subjectAddress`. */
  requestSubjectAddress: string
  onRequestSubjectAddressChange: (address: string) => void
  contextId: string
  trustTier: string
  onApplyScannedRequest: (data: { subjectAddress: string; contextId: string; trustTier: number }) => void
  keyringUnlocked: boolean
}

export function AttestationQrPanel({
  accounts,
  requestSubjectAddress,
  onRequestSubjectAddressChange,
  contextId,
  trustTier,
  onApplyScannedRequest,
  keyringUnlocked,
}: AttestationQrPanelProps) {
  const headingId = useId()
  const [pastePayload, setPastePayload] = useState('')
  const [parsed, setParsed] = useState<AttestationQrV1Payload | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [scannerOn, setScannerOn] = useState(false)
  const [scannerHint, setScannerHint] = useState<string | null>(null)
  const html5ScannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)

  const tierNum = Number.parseInt(trustTier, 10)
  const tierOk = Number.isFinite(tierNum) && tierNum >= 0

  const requestSubjectOk = useMemo(() => {
    const t = requestSubjectAddress.trim()
    if (!t) return false
    try {
      decodeAddress(t)
    } catch {
      return false
    }
    return accounts.some((a) => a.address === t)
  }, [requestSubjectAddress, accounts])

  const qrString = useMemo(() => {
    if (!requestSubjectOk || !tierOk) return ''
    return buildAttestationQrString({
      subjectAddress: requestSubjectAddress.trim(),
      contextId: contextId.trim() || 'default',
      trustTier: tierNum,
    })
  }, [requestSubjectAddress, contextId, requestSubjectOk, tierOk, tierNum])

  const handleDecodePaste = useCallback(() => {
    setParseError(null)
    setParsed(null)
    const res = parseAttestationQrString(pastePayload)
    if (!res.ok) {
      setParseError(res.error)
      return
    }
    setParsed(res.data)
  }, [pastePayload])

  const handleApplyParsed = useCallback(() => {
    if (!parsed) return
    onApplyScannedRequest({
      subjectAddress: parsed.subjectAddress.trim(),
      contextId: parsed.contextId.trim() || 'default',
      trustTier: parsed.trustTier,
    })
    setScannerHint('Solicitud aplicada: el sujeto quedó fijado por el protocolo del código.')
  }, [parsed, onApplyScannedRequest])

  useEffect(() => {
    if (!scannerOn) return

    let cancelled = false

    const stopScanner = () => {
      const s = html5ScannerRef.current
      html5ScannerRef.current = null
      if (!s) return
      void s
        .stop()
        .then(() => s.clear())
        .catch(() => {
          /* ignore */
        })
    }

    const run = async () => {
      setScannerHint(null)
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode(QR_READER_DOM_ID, { verbose: false })
        if (cancelled) {
          await scanner.clear().catch(() => {
            /* ignore */
          })
          return
        }
        html5ScannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (text) => {
            const res = parseAttestationQrString(text)
            if (res.ok) {
              setParsed(res.data)
              setParseError(null)
              setPastePayload(text)
              setScannerHint('Código válido. Puede detener la cámara y revisar los datos abajo.')
            }
          },
          () => {
            /* frames sin QR: se ignoran */
          }
        )
        if (cancelled) stopScanner()
      } catch (e) {
        if (!cancelled) {
          setParseError(e instanceof Error ? e.message : String(e))
          setScannerOn(false)
        }
        stopScanner()
      }
    }

    void run()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [scannerOn])

  return (
    <div className="grid gap-4 md:grid-cols-2" aria-labelledby={headingId}>
      <span id={headingId} className="sr-only">
        Códigos QR de solicitud de atestación
      </span>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5" />
            Mi código para que me atesten
          </CardTitle>
          <CardDescription>
            Solo puede generarse con <strong>una de sus cuentas en este dispositivo</strong>. Otra persona
            escanea el código y firma como atestador: el sujeto queda definido por el escaneo, no por texto
            libre, para apoyar ceremonias presenciales o virtuales coordinadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!keyringUnlocked ? (
            <p className="text-sm text-muted-foreground">
              Desbloquee el keyring para elegir la cuenta solicitante entre las cargadas localmente.
            </p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cuentas locales. Importe o cree una cuenta.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Cuenta que solicita ser atestada (contenido del código)</Label>
                <RadioGroup
                  value={requestSubjectAddress}
                  onValueChange={onRequestSubjectAddressChange}
                  className="flex flex-col gap-2"
                >
                  {accounts.map((a) => (
                    <div key={a.address} className="flex items-start gap-2 min-w-0">
                      <RadioGroupItem value={a.address} id={`qr-req-${a.address}`} className="mt-1 shrink-0" />
                      <Label
                        htmlFor={`qr-req-${a.address}`}
                        className="font-normal cursor-pointer min-w-0 flex-1 space-y-1"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{a.name ?? 'Sin nombre'}</span>
                          {a.keypairType ? (
                            <Badge
                              variant={keypairTypeBadgeVariant(a.keypairType)}
                              className="text-[10px] uppercase tracking-wide"
                            >
                              {a.keypairType}
                            </Badge>
                          ) : null}
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
                  ))}
                </RadioGroup>
              </div>
              <p className="text-xs text-muted-foreground">
                Contexto y nivel de confianza del formulario de atestación (debajo) se incluyen en este
                código. Acuerde esos valores con quien vaya a firmar antes de mostrar el QR.
              </p>
            </>
          )}
          {!requestSubjectOk || !tierOk ? (
            <p className="text-sm text-muted-foreground">
              Seleccione una cuenta local válida y un nivel de confianza numérico para generar el código.
            </p>
          ) : (
            <>
              <div className="flex justify-center rounded-md border bg-white p-4">
                <QRCodeSVG value={qrString} size={200} level="M" includeMargin />
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Contenido JSON (referencia)</summary>
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 font-mono whitespace-pre-wrap">
                  {qrString}
                </pre>
              </details>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="h-5 w-5" />
            Escanear solicitud (otorgar atestación)
          </CardTitle>
          <CardDescription>
            Pegue el texto leído del código o use la cámara. Solo se aceptan solicitudes con{' '}
            <code className="text-xs">kind: &quot;{YOHUALLI_ATTESTATION_QR_KIND}&quot;</code> y{' '}
            <code className="text-xs">schemaVersion: 1</code>. Al aplicar, el sujeto queda bloqueado hasta
            que lo libere de forma explícita.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr-paste">Texto del código (JSON)</Label>
            <Textarea
              id="qr-paste"
              rows={4}
              className="font-mono text-xs"
              placeholder='{"kind":"yohualli_attestation_request",...}'
              value={pastePayload}
              onChange={(e) => setPastePayload(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleDecodePaste}>
                Decodificar y validar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setParseError(null)
                  setScannerOn((v) => !v)
                }}
              >
                <Camera className="h-4 w-4 mr-1" />
                {scannerOn ? 'Detener cámara' : 'Escanear con cámara'}
              </Button>
            </div>
          </div>

          {scannerOn ? (
            <div className="space-y-2">
              <div id={QR_READER_DOM_ID} className="w-full overflow-hidden rounded-md border bg-black/5" />
              {scannerHint ? <p className="text-xs text-muted-foreground">{scannerHint}</p> : null}
            </div>
          ) : null}

          {parseError ? (
            <Alert variant="destructive">
              <AlertTitle>No válido</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          ) : null}

          {parsed ? (
            <Alert>
              <AlertTitle>Solicitud reconocida</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                  <li>
                    <span className="text-muted-foreground">Sujeto (quien pidió el código): </span>
                    <span className="font-mono text-xs break-all">{parsed.subjectAddress}</span>
                  </li>
                  <li>
                    <span className="text-muted-foreground">Contexto: </span>
                    {parsed.contextId}
                  </li>
                  <li>
                    <span className="text-muted-foreground">Nivel de confianza: </span>
                    {parsed.trustTier}
                  </li>
                </ul>
                <Button type="button" className="mt-3" size="sm" onClick={handleApplyParsed}>
                  Aplicar al formulario y bloquear sujeto
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
