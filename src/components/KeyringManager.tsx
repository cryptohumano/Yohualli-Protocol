import { useState, useMemo } from 'react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Key, Plus, Trash2, Copy, Check, ExternalLink, KeyRound } from 'lucide-react'
import type { KeyringAccount } from '@/hooks/useKeyring'
import Identicon from '@polkadot/react-identicon'
import { deriveEthereumAddressFromPair } from '@/utils/ethereum'
import { DualSubstrateAddressLines } from '@/components/DualSubstrateAddressLines'
import { ensureYohualliSubstrateSuri, YOHUALLI_SUBSTRATE_DERIVATION } from '@/social-graph/yohualliSubstratePath'
import { AccountSecretsDialog } from '@/components/AccountSecretsDialog'

export function KeyringManager() {
  const { keyring, isReady, accounts, isUnlocked, generateMnemonic, addFromUri, removeAccount } = useKeyringContext()
  const [mnemonic, setMnemonic] = useState('')
  const [uri, setUri] = useState('')
  const [accountName, setAccountName] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [generatedMnemonic, setGeneratedMnemonic] = useState('')
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [ethereumAddresses, setEthereumAddresses] = useState<Record<string, string | null>>({})
  const [secretsDialogFor, setSecretsDialogFor] = useState<string | null>(null)
  /** Si es true, se aplica `//yohualli` a BIP39/SURI al importar (recomendado en esta PWA). */
  const [applyYohualliOnImport, setApplyYohualliOnImport] = useState(true)

  const buildImportSuri = (raw: string) => {
    const t = raw.trim()
    if (!t) return t
    return applyYohualliOnImport ? ensureYohualliSubstrateSuri(t) : t
  }

  const handleGenerateMnemonic = () => {
    const newMnemonic = generateMnemonic()
    setGeneratedMnemonic(newMnemonic)
    setMnemonic(newMnemonic) // Pasar automáticamente al campo de mnemonic
    setShowMnemonic(true)
  }

  const [password, setPassword] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)

  const handleAddFromMnemonic = async () => {
    if (!mnemonic.trim()) return
    if (!isUnlocked) {
      alert('Por favor desbloquea el keyring primero')
      return
    }
    
    const suri = buildImportSuri(mnemonic)
    await addFromUri(suri, accountName || undefined, 'sr25519', password || undefined)
    setMnemonic('')
    setAccountName('')
    setPassword('')
    setShowPasswordInput(false)
  }

  const handleAddFromUri = async () => {
    if (!uri.trim()) return
    if (!isUnlocked) {
      alert('Por favor desbloquea el keyring primero')
      return
    }
    
    const name = accountName.trim() || undefined
    const suri = buildImportSuri(uri)
    await addFromUri(suri, name, 'sr25519', password || undefined)
    setUri('')
    if (name) setAccountName('')
    setPassword('')
    setShowPasswordInput(false)
  }

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  // Derivar direcciones Ethereum para todas las cuentas
  useMemo(() => {
    if (!keyring || accounts.length === 0) return

    const derived: Record<string, string | null> = {}
    accounts.forEach((account) => {
      try {
        const pair = keyring.getPair(account.address)
        // Intentar derivar desde el pair (funciona si es ECDSA)
        const ethAddress =
          account.evmBip44Address ?? deriveEthereumAddressFromPair(pair)
        derived[account.address] = ethAddress
      } catch (error) {
        console.debug(`No se pudo derivar dirección Ethereum para ${account.address}:`, error)
        derived[account.address] = null
      }
    })
    setEthereumAddresses(derived)
  }, [accounts, keyring])

  if (!isReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Inicializando keyring...</p>
        </CardContent>
      </Card>
    )
  }

  // Permitir generar mnemonics incluso si no está desbloqueado
  // Pero mostrar advertencia si no está desbloqueado
  if (!isUnlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cuentas</CardTitle>
          <CardDescription>
            Genera mnemonics o desbloquea el keyring para gestionar tus cuentas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Permitir generar mnemonic incluso sin desbloquear */}
          <div className="space-y-2">
            <Button onClick={handleGenerateMnemonic} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Generar Nuevo Mnemonic
            </Button>
            {showMnemonic && generatedMnemonic && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Mnemonic generado (guárdalo de forma segura):</p>
                <p className="text-sm font-mono break-all mb-2">{generatedMnemonic}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                  ⚠️ Desbloquea el keyring primero para poder crear una cuenta con este mnemonic
                </p>
              </div>
            )}
          </div>
          
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Para crear cuentas:</strong> Desbloquea el keyring usando el componente "Desbloquear Keyring" arriba.
              Si no tienes cuentas almacenadas, puedes desbloquear con cualquier contraseña (se creará una nueva sesión).
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cuentas (Keyring)</CardTitle>
          <CardDescription>
            Crea y gestiona cuentas usando @polkadot/keyring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2">
            <strong>Yohualli (grafo / relay):</strong> las frases BIP39 y SURI se importan bajo la ruta Substrate
            fija <code className="text-[11px]">{YOHUALLI_SUBSTRATE_DERIVATION}</code> (si aún no indicás otra
            derivación en la URI). Así el SS58 transmitido coincide con la identidad de protocolo. Cuentas con
            frase o URI se guardan como <strong>sr25519</strong>; EVM (BIP44) y ed25519/ecdsa duales se siguen
            mostrando cuando hay material de derivación local. Las distintas ramas BIP44 (MetaMask, atestación
            Yohualli) no se eligen al importar: la PWA aplica en cada acción la ruta correcta sobre la misma
            frase; ver pestaña <strong>Rutas</strong> al revelar claves.
          </p>
          {isUnlocked && (
            <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
              <Checkbox
                id="yohualli-path"
                checked={applyYohualliOnImport}
                onCheckedChange={(v) => setApplyYohualliOnImport(v === true)}
              />
              <div className="space-y-1 text-xs text-muted-foreground">
                <Label htmlFor="yohualli-path" className="text-sm text-foreground cursor-pointer font-medium">
                  Identidad Yohualli (Substrate)
                </Label>
                <p>
                  Activo: añade o respeta <code className="text-[11px]">{YOHUALLI_SUBSTRATE_DERIVATION}</code> a la
                  SURI, para alinear el SS58 con el grafo y el relay. Desactivalo si importás un SURI/seed para
                  pruebas o rutas 100% personalizadas.
                </p>
              </div>
            </div>
          )}

          {/* Generar Mnemonic */}
          <div className="space-y-2">
            <Button onClick={handleGenerateMnemonic} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Generar Nuevo Mnemonic
            </Button>
            {showMnemonic && generatedMnemonic && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Mnemonic generado (guárdalo de forma segura):</p>
                <p className="text-sm font-mono break-all mb-2">{generatedMnemonic}</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setMnemonic(generatedMnemonic)
                    setShowMnemonic(false)
                  }}
                  variant="outline"
                >
                  Usar este mnemonic
                </Button>
                <Button
                  size="sm"
                  className="ml-2"
                  onClick={async () => {
                    if (!isUnlocked) {
                      alert('Por favor desbloquea el keyring primero')
                      return
                    }
                    setMnemonic(generatedMnemonic)
                    setShowMnemonic(false)
                    // Crear la cuenta automáticamente
                    const suri = buildImportSuri(generatedMnemonic)
                    await addFromUri(suri, accountName.trim() || undefined, 'sr25519', password || undefined)
                    setMnemonic('')
                    setAccountName('')
                    setGeneratedMnemonic('')
                    setShowMnemonic(false)
                    setPassword('')
                  }}
                  disabled={!isUnlocked}
                >
                  Usar y crear cuenta
                </Button>
              </div>
            )}
          </div>

          {/* Agregar desde Mnemonic */}
          <div className="space-y-2">
            <Input
              placeholder={
                applyYohualliOnImport
                  ? 'BIP39: con identidad Yohualli, se añade //yohualli a la SURI (salvo otra ruta tuya).'
                  : 'BIP39 / SURI: no se añade //yohualli (ruta exacta tuya).'
              }
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              disabled={!isUnlocked}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Nombre de la cuenta (opcional)"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="flex-1"
                disabled={!isUnlocked}
              />
              <Button onClick={handleAddFromMnemonic} disabled={!mnemonic.trim() || !isUnlocked}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </div>
            {isUnlocked && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Contraseña para encriptar (opcional, se guardará encriptada)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si proporcionas una contraseña, la cuenta se guardará encriptada en IndexedDB
                </p>
              </div>
            )}
          </div>

          {/* Agregar desde URI (Substrate URI) */}
          <div className="space-y-2">
            <Input
              placeholder={
                applyYohualliOnImport
                  ? 'SURI: BIP39, 0x…, //Alice… (Yohualli: se ajusta SURI a //yohualli si aplica).'
                  : 'SURI exacta, sin añadir //yohualli (avanzado).'
              }
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              disabled={!isUnlocked}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Nombre de la cuenta (opcional)"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="flex-1"
                disabled={!isUnlocked}
              />
              <Button onClick={handleAddFromUri} disabled={!uri.trim() || !isUnlocked} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Agregar desde URI
              </Button>
            </div>
            {isUnlocked && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Contraseña para encriptar (opcional, se guardará encriptada)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si proporcionas una contraseña, la cuenta se guardará encriptada en IndexedDB
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Cuentas */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cuentas ({accounts.length})</CardTitle>
            <CardDescription>
              Cuentas agregadas al keyring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts.map((account: KeyringAccount) => (
                <div
                  key={account.address}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Identicon
                        value={account.address}
                        size={24}
                        theme="polkadot"
                      />
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium truncate">
                        {account.meta.name || 'Sin nombre'}
                      </p>
                    </div>
                    {(() => {
                      const ethResolved =
                        account.evmBip44Address ?? ethereumAddresses[account.address] ?? null
                      if (account.dualSubstrateSs58) {
                        return (
                          <DualSubstrateAddressLines
                            dual={account.dualSubstrateSs58}
                            evmAddress={ethResolved}
                            className="mt-1"
                          />
                        )
                      }
                      return (
                        <>
                          <p className="text-sm font-mono break-all text-muted-foreground">{account.address}</p>
                          {ethResolved ? (
                            <div className="mt-2 space-y-1">
                              <p className="text-[11px] text-muted-foreground">Dirección EVM (si aplica):</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="text-xs font-mono break-all">{ethResolved}</code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  type="button"
                                  onClick={() => handleCopyAddress(ethResolved)}
                                >
                                  {copiedAddress === ethResolved ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  type="button"
                                  onClick={() =>
                                    window.open(`https://etherscan.io/address/${ethResolved}`, '_blank')
                                  }
                                  title="Ver en Etherscan"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      )
                    })()}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {keyring?.getPair(account.address).type || 'sr25519'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {account.publicKey.length * 8} bits
                      </Badge>
                      {(account.evmBip44Address ?? ethereumAddresses[account.address]) && (
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          EVM
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-4 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      type="button"
                      title="Mnemónico, SURI, PRIVATE_KEY, rutas; se bloquea al salir o minimizar"
                      onClick={() => setSecretsDialogFor(account.address)}
                    >
                      <KeyRound className="h-3 w-3 mr-1" />
                      Claves y frase
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyAddress(account.address)}
                    >
                      {copiedAddress === account.address ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAccount(account.address)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {secretsDialogFor && (
        <AccountSecretsDialog
          open
          onOpenChange={(o) => {
            if (!o) setSecretsDialogFor(null)
          }}
          address={secretsDialogFor}
          accountName={accounts.find((a) => a.address === secretsDialogFor)?.meta.name || 'Sin nombre'}
          evmBip44Address={
            accounts.find((a) => a.address === secretsDialogFor)?.evmBip44Address ??
            ethereumAddresses[secretsDialogFor] ??
            null
          }
        />
      )}
    </div>
  )
}

