import { useState, useEffect, useCallback, useId } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { YOHUALLI_SUBSTRATE_DERIVATION } from '@/social-graph/yohualliSubstratePath'
import { YOHUALLI_ATTESTATION_BIP44_PATH, getYohualliAttestationSignerFromHdSuri } from '@/utils/yohualliAttestationEip712'
import { Copy, Wrench, AlertTriangle, Route } from 'lucide-react'
import { cn } from '@/lib/utils'

const UNLOCK = 'EXPORT'
const SESSION_MS = 3 * 60_000

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  accountName: string
  evmBip44Address: string | null
}

function Redacted({ children, show }: { children: string; show: boolean }) {
  if (show) return <span className="font-mono break-all text-sm">{children}</span>
  return <span className="select-none blur-md text-muted-foreground">· · · redactado · · ·</span>
}

export function AccountSecretsDialog({ open, onOpenChange, address, accountName, evmBip44Address }: Props) {
  const { getEvmBip44PrivateKey0x, getDerivationMaterial } = useKeyringContext()
  const [confirm, setConfirm] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [reveal, setReveal] = useState(false)
  const formId = useId()

  const mat = getDerivationMaterial(address)
  const priv0x = getEvmBip44PrivateKey0x(address)
  const hasMaterial = mat != null || priv0x != null
  const hdSuri = mat?.kind === 'bip39' ? mat.fullSuri : null
  const attestation0x = hdSuri
    ? getYohualliAttestationSignerFromHdSuri(hdSuri)?.address ?? null
    : null

  const hardReset = useCallback(() => {
    setUnlocked(false)
    setConfirm('')
    setReveal(false)
  }, [])

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) hardReset()
      onOpenChange(o)
    },
    [onOpenChange, hardReset]
  )

  // Cierre automático al abandonar la pestaña / minimizar
  useEffect(() => {
    if (!unlocked) return
    const onVis = () => {
      if (document.visibilityState === 'hidden') hardReset()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [unlocked, hardReset])

  // Tope de sesión
  useEffect(() => {
    if (!unlocked) return
    const t = window.setTimeout(() => hardReset(), SESSION_MS)
    return () => window.clearTimeout(t)
  }, [unlocked, hardReset, open, address])

  // Al cerrar o cambiar cuenta, reset
  useEffect(() => {
    if (!open) hardReset()
  }, [open, address, hardReset])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[min(100vw-1rem,28rem)] max-w-none sm:max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Wrench className="h-4 w-4 shrink-0" />
            Claves y material de restauración
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              Cuenta <span className="text-foreground font-medium">{accountName}</span>
              {evmBip44Address && (
                <span>
                  — EVM: <code className="text-[10px] break-all sm:text-xs">{evmBip44Address}</code>
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded border border-amber-600/30 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-100/90">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Podés leer y copiar sin cerrar la PWA, pero al minimizar o cambiar de ventana <strong>se vuelve a
            bloquear</strong> y a los ~3 minutos también. <strong>EXPORT</strong> requerido otra vez.
            No condividas pantalla, grabaciones ni repositorios con estos valores.
          </p>
        </div>

        {!unlocked && (
          <form
            id={formId}
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (confirm === UNLOCK) {
                setUnlocked(true)
                setReveal(false)
                setConfirm('')
              }
            }}
          >
            <p className="text-sm text-muted-foreground">
              Escribe <code className="text-foreground">{UNLOCK}</code> para abrir la vista de claves.
            </p>
            <Input
              className="font-mono"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={UNLOCK}
              autoComplete="off"
              name="keyring-export-confirm"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={!hasMaterial}
            >
              Desbloquear vista
            </Button>
            {mat == null && priv0x == null && (
              <p className="text-destructive text-xs">
                Sin SURI o frase en memoria (p. ej. import JSON de Polkadot.js) — no se puede mostrar nada.
              </p>
            )}
          </form>
        )}

        {unlocked && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border"
                  checked={reveal}
                  onChange={(e) => setReveal(e.target.checked)}
                />
                Dejar de ocultar texto (désactivalo si alguien puede ver la pantalla)
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={hardReset}
                className="h-7 text-xs"
              >
                Bloquear ahora
              </Button>
            </div>
            <Tabs defaultValue="paths" className="w-full">
              <TabsList className="flex w-full flex-wrap h-auto min-h-9 p-1 gap-1">
                <TabsTrigger value="paths" className="text-xs sm:text-sm">
                  <Route className="h-3 w-3 sm:mr-1" />
                  Rutas
                </TabsTrigger>
                {mat?.kind === 'bip39' && (
                  <>
                    <TabsTrigger value="bip39" className="text-xs sm:text-sm">
                      BIP39
                    </TabsTrigger>
                    <TabsTrigger value="suri" className="text-xs sm:text-sm">
                      SURI
                    </TabsTrigger>
                  </>
                )}
                <TabsTrigger value="evm" className="text-xs sm:text-sm">
                  EVM 0x
                </TabsTrigger>
              </TabsList>
              <TabsContent value="paths" className="text-xs sm:text-sm space-y-2 border rounded-md p-3 bg-muted/20">
                {mat?.kind === 'raw_key' && (
                  <p className="text-amber-800 dark:text-amber-200/90 text-xs mb-2">
                    Cuenta importada con <strong>clave 0x</strong> cruda: no aplica BIP39 ni múltiples
                    derivaciones; la EOA es esa clave.
                  </p>
                )}
                <p className="text-muted-foreground">
                  Misma frase, distintas ramas según <strong>acción</strong> (no hace falta reimportar para cada
                  ruta; la PWA aplica en código la que toque):
                </p>
                <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] sm:text-xs">
                  <li>
                    Substrate Yohualli (SS58): ruta fija <code className="break-all">{YOHUALLI_SUBSTRATE_DERIVATION}</code> al
                    importar con “Identidad Yohualli” activada.
                  </li>
                  <li>
                    EVM &quot;tipo MetaMask&quot; / <code className="break-all">PRIVATE_KEY</code> (deploy, testnet,
                    PVM): <code className="break-all">m/44&apos;/60&apos;/0&apos;/0/0</code>
                    {evmBip44Address && (
                      <span className="ml-1 text-foreground/80">— {evmBip44Address}</span>
                    )}
                  </li>
                  <li>
                    Atestación EIP-712 (Yohualli): <code className="break-all">{YOHUALLI_ATTESTATION_BIP44_PATH}</code>
                    {attestation0x && <span className="ml-1 break-all text-foreground/80">— {attestation0x}</span>}
                  </li>
                </ul>
              </TabsContent>
              {mat?.kind === 'bip39' && (
                <TabsContent value="bip39" className="space-y-2 text-sm">
                  {mat.hasBip39Passphrase && (
                    <p className="text-amber-700 dark:text-amber-200 text-xs">
                      Cuenta con BIP39 passphrase (parte de la SURI con <code>///</code>); usá <strong>tab SURI</strong> para
                      restaurar 1:1, o reimportar con el mismo SURI.
                    </p>
                  )}
                  <div
                    className={cn(
                      'rounded border p-2',
                      !reveal && 'select-none'
                    )}
                  >
                    <Redacted show={reveal}>{mat.words}</Redacted>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!reveal}
                      onClick={async () => {
                        if (!reveal) return
                        await navigator.clipboard.writeText(mat.words)
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar frase
                    </Button>
                  </div>
                </TabsContent>
              )}
              {mat?.kind === 'bip39' && (
                <TabsContent value="suri" className="space-y-2 text-sm">
                  <p className="text-xs text-muted-foreground">Copia idéntica a la SURI almacenada (Substrate, rutas, contraseñas BIP39).</p>
                  <div className="rounded border p-2 break-all text-[11px] sm:text-xs font-mono max-h-32 overflow-y-auto">
                    <Redacted show={reveal}>{mat.fullSuri}</Redacted>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!reveal}
                    onClick={async () => {
                      if (!reveal) return
                      await navigator.clipboard.writeText(mat.fullSuri)
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar SURI
                  </Button>
                </TabsContent>
              )}
              <TabsContent value="evm" className="space-y-2 text-sm">
                {mat?.kind === 'raw_key' && (
                  <p className="text-xs text-amber-700 dark:text-amber-200/90">
                    Import 0x cruda: el valor es la EOA entera, no pasa por BIP39/derivación MetaMask.
                  </p>
                )}
                {priv0x == null ? (
                  <p className="text-destructive text-xs">No se pudo derivar la clave EVM (m/44&apos;/60&apos;/0&apos;/0/0) desde este material.</p>
                ) : (
                  <>
                    <div
                      className={cn(
                        'rounded border p-2 font-mono text-[11px] sm:text-xs break-all',
                        !reveal && 'select-none'
                      )}
                    >
                      <Redacted show={reveal}>{`PRIVATE_KEY=${priv0x}`}</Redacted>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!reveal}
                        onClick={async () => {
                          if (!reveal) return
                          await navigator.clipboard.writeText(priv0x)
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar 0x
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!reveal}
                        onClick={async () => {
                          if (!reveal) return
                          await navigator.clipboard.writeText(`PRIVATE_KEY=${priv0x}`)
                        }}
                      >
                        Copiar línea .env
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
