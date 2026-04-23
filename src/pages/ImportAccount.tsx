import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { AlertCircle, CheckCircle, Copy, Eye, EyeOff, Key, FileText, Users } from 'lucide-react'
import { decryptPolkadotJsBackup, isPolkadotJsBackup } from '@/utils/polkadotJsBackup'
import { getAllEncryptedAccounts, verifyWalletStoragePassword } from '@/utils/secureStorage'
import { useTranslation } from 'react-i18next'

type ImportMethod = 'mnemonic' | 'uri' | 'json'

export default function ImportAccount() {
  const { t } = useTranslation('pages')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addFromMnemonic, addFromUri, addFromJson, isUnlocked, unlock } = useKeyringContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Obtener el método desde los query params, por defecto 'mnemonic'
  const methodFromUrl = searchParams.get('method') as ImportMethod | null
  const [method, setMethod] = useState<ImportMethod>(methodFromUrl || 'mnemonic')

  // Actualizar el método si cambia en la URL
  useEffect(() => {
    if (methodFromUrl && ['mnemonic', 'uri', 'json'].includes(methodFromUrl)) {
      setMethod(methodFromUrl)
    }
  }, [methodFromUrl])
  const [mnemonic, setMnemonic] = useState('')
  const [uri, setUri] = useState('')
  const [jsonData, setJsonData] = useState('')
  const [jsonFile, setJsonFile] = useState<File | null>(null)
  const [jsonPassword, setJsonPassword] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [importedAddress, setImportedAddress] = useState<string | null>(null)
  
  // Estado para backup completo de Polkadot.js
  const [backupAccounts, setBackupAccounts] = useState<Array<{ address: string; json: any; meta: any }>>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [showAccountSelection, setShowAccountSelection] = useState(false)

  // Validar longitud BIP39 habitual (12–24 palabras en saltos de 3)
  const validateMnemonic = (mnemonic: string): boolean => {
    const words = mnemonic.trim().split(/\s+/).filter(Boolean)
    return [12, 15, 18, 21, 24].includes(words.length)
  }

  const handleImport = async () => {
    setError('')
    setSuccess(false)
    setImportedAddress(null)

    // Validar contraseña si se proporciona
    if (password) {
      if (password.length < 8) {
        setError(t('import.errors.passwordMin'))
        return
      }
      if (password !== confirmPassword) {
        setError(t('import.errors.passwordsMismatch'))
        return
      }
    }

    setLoading(true)

    try {
      // Si no está desbloqueado y hay contraseña, intentar desbloquear primero
      if (!isUnlocked && password) {
        const unlocked = await unlock(password)
        if (!unlocked) {
          setError(t('import.errors.unlockFailed'))
          setLoading(false)
          return
        }
      }

      const alreadyStored = await getAllEncryptedAccounts()
      if (alreadyStored.length > 0) {
        if (!password) {
          setError(t('import.errors.needPasswordEncrypted'))
          setLoading(false)
          return
        }
        if (!(await verifyWalletStoragePassword(password))) {
          setError(t('import.errors.passwordMismatchEnc'))
          setLoading(false)
          return
        }
      }

      let account = null

      switch (method) {
        case 'mnemonic':
          if (!mnemonic.trim()) {
            setError(t('import.errors.needMnemonic'))
            setLoading(false)
            return
          }

          if (!validateMnemonic(mnemonic)) {
            setError(t('import.errors.badMnemonic'))
            setLoading(false)
            return
          }

          account = await addFromMnemonic(
            mnemonic.trim(),
            name.trim() || undefined,
            'sr25519',
            password || undefined
          )
          break

        case 'uri':
          if (!uri.trim()) {
            setError(t('import.errors.needUri'))
            setLoading(false)
            return
          }

          account = await addFromUri(
            uri.trim(),
            name.trim() || undefined,
            'sr25519',
            password || undefined
          )
          break

        case 'json':
          try {
            let parsed: any

            // Si hay un archivo seleccionado, leerlo
            if (jsonFile) {
              const fileContent = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = (e) => resolve(e.target?.result as string)
                reader.onerror = () => reject(new Error(t('import.errors.fileRead')))
                reader.readAsText(jsonFile)
              })
              parsed = JSON.parse(fileContent)
            } else if (jsonData) {
              parsed = JSON.parse(jsonData)
            } else {
              setError(t('import.errors.needFileOrPaste'))
              setLoading(false)
              return
            }

            // Verificar si es un archivo de backup de Yohualli Protocol
            if (parsed.version && parsed.accounts && Array.isArray(parsed.accounts) && !parsed.encoded) {
              // Es un archivo de backup completo de Yohualli Protocol
              setError(t('import.errors.fullBackupYohualli'))
              setLoading(false)
              return
            }

            // Verificar si es un backup completo de Polkadot.js (tiene 'encoded' y 'accounts' array)
            if (isPolkadotJsBackup(parsed)) {
              // Es un backup completo de Polkadot.js con múltiples cuentas
              if (!jsonPassword) {
                setError(t('import.errors.needPolkadotJsonPassword'))
                setLoading(false)
                return
              }

              try {
                // Desencriptar el backup completo
                const accounts = await decryptPolkadotJsBackup(parsed, jsonPassword)
                
                if (accounts.length === 0) {
                  setError(t('import.errors.noAccountsInBackup'))
                  setLoading(false)
                  return
                }
                
                // Mostrar UI de selección de cuentas
                setBackupAccounts(accounts)
                setSelectedAccounts(new Set(accounts.map(acc => acc.address)))
                setShowAccountSelection(true)
                setLoading(false)
                return
              } catch (err) {
                setError(err instanceof Error ? err.message : t('import.errors.decryptPolkadotFail'))
                setLoading(false)
                return
              }
            }

            // Verificar si es un JSON de Polkadot.js individual (tiene 'address' y 'encoded')
            if (parsed.address && parsed.encoded) {
              // Es un JSON de Polkadot.js
              if (!jsonPassword) {
                setError(t('import.errors.needPolkadotPassword'))
                setLoading(false)
                return
              }

              account = await addFromJson(
                parsed,
                jsonPassword,
                password || undefined
              )
            } else if (parsed.mnemonic) {
              // JSON con mnemonic simple
              if (!validateMnemonic(parsed.mnemonic)) {
                setError(t('import.errors.mnemonicInJson'))
                setLoading(false)
                return
              }
              account = await addFromMnemonic(
                parsed.mnemonic,
                parsed.name || name.trim() || undefined,
                parsed.type || 'sr25519',
                password || undefined
              )
            } else if (parsed.uri || parsed.seed) {
              // JSON con URI o seed
              account = await addFromUri(
                parsed.uri || parsed.seed,
                parsed.name || name.trim() || undefined,
                parsed.type || 'sr25519',
                password || undefined
              )
            } else {
              // Verificar si podría ser un backup completo de Yohualli Protocol
              if (parsed.version || (parsed.accounts && Array.isArray(parsed.accounts))) {
                setError(t('import.errors.fullBackupYohualli2'))
              } else {
                setError(t('import.errors.badJson'))
              }
              setLoading(false)
              return
            }
          } catch (err) {
            if (err instanceof Error && err.message.includes('Invalid password')) {
              setError(t('import.errors.wrongJsonPassword'))
            } else {
              setError(err instanceof Error ? err.message : t('import.errors.invalidJson'))
            }
            setLoading(false)
            return
          }
          break
      }

      if (account) {
        setImportedAddress(account.address)
        setSuccess(true)
        
        // Limpiar formulario
        setMnemonic('')
        setUri('')
        setJsonData('')
        setJsonFile(null)
        setJsonPassword('')
        setName('')
        setPassword('')
        setConfirmPassword('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // Redirigir después de 2 segundos
        setTimeout(() => {
          navigate('/accounts')
        }, 2000)
      } else {
        setError(t('import.errors.importFailedGeneric'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.errors.importFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopyAddress = async () => {
    if (importedAddress) {
      await navigator.clipboard.writeText(importedAddress)
    }
  }

  const handleImportSelectedAccounts = async () => {
    if (selectedAccounts.size === 0) {
      setError(t('import.errors.selectAtLeast'))
      return
    }

    if (!jsonPassword) {
      setError(t('import.errors.needPolkadotPassword'))
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Verificar si hay cuentas almacenadas
      const storedAccounts = await getAllEncryptedAccounts()
      const hasStoredAccounts = storedAccounts.length > 0

      // Determinar la contraseña final a usar
      let finalPassword: string | undefined = undefined

      // Si hay cuentas almacenadas, requerir contraseña para desbloquear
      if (hasStoredAccounts && !isUnlocked) {
        if (!password || password.trim().length === 0) {
          setError(t('import.errors.needPasswordUnlock'))
          setLoading(false)
          return
        }
        const unlocked = await unlock(password.trim())
        if (!unlocked) {
          setError(t('import.errors.unlockFailed'))
          setLoading(false)
          return
        }
        // Usar la contraseña que desbloqueó el wallet
        finalPassword = password.trim()
      } else if (hasStoredAccounts && isUnlocked) {
        // Si el wallet ya está desbloqueado, requerir contraseña para guardar las nuevas cuentas
        if (!password || password.trim().length === 0) {
          setError(t('import.errors.needPasswordSave'))
          setLoading(false)
          return
        }
        // Validar que la contraseña sea correcta intentando desbloquear (aunque ya esté desbloqueado)
        // O simplemente usar la contraseña proporcionada
        finalPassword = password.trim()
      } else {
        // Si no hay cuentas almacenadas, requerir contraseña para guardar las nuevas cuentas
        if (!password || password.trim().length === 0) {
          setError(t('import.errors.needPasswordNew'))
          setLoading(false)
          return
        }

        // Validar longitud mínima
        if (password.trim().length < 8) {
          setError(t('import.errors.passwordMin'))
          setLoading(false)
          return
        }

        // Validar que coincidan
        if (confirmPassword && password.trim() !== confirmPassword.trim()) {
          setError(t('import.errors.passwordsMismatch'))
          setLoading(false)
          return
        }

        finalPassword = password.trim()
      }

      // Asegurar que tenemos una contraseña válida antes de importar
      if (!finalPassword || finalPassword.length === 0) {
        setError(t('import.errors.needValidPassword'))
        setLoading(false)
        return
      }

      const accountsToImport = backupAccounts.filter(acc => selectedAccounts.has(acc.address))
      const imported: string[] = []
      const errors: string[] = []

      for (const accountData of accountsToImport) {
        try {
          // Cada cuenta en el backup desencriptado debería tener formato JSON de Polkadot.js
          // Verificar que tenga address y encoded
          if (!accountData.json || !accountData.json.address || !accountData.json.encoded) {
            const accountName = accountData.meta?.name || accountData.address
            errors.push(t('import.errors.invalidFormatLine', { name: accountName }))
            continue
          }
          
          // Usar addFromJson para importar cada cuenta individual
          // La contraseña del JSON es la misma para todas las cuentas del backup
          // Usar finalPassword que ya fue validado arriba
          const account = await addFromJson(
            accountData.json,
            jsonPassword,
            finalPassword
          )
          
          if (account) {
            imported.push(account.address)
            console.log(`[Import] ✅ Cuenta importada: ${account.address} (${accountData.meta?.name || 'Sin nombre'})`)
          }
        } catch (err) {
          const accountName = accountData.meta?.name || accountData.address
          const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
          errors.push(`${accountName}: ${errorMsg}`)
          console.error(`[Import] ❌ Error al importar cuenta ${accountName}:`, err)
        }
      }

      if (imported.length > 0) {
        setSuccess(true)
        setImportedAddress(imported[0])
        setShowAccountSelection(false)
        setBackupAccounts([])
        setSelectedAccounts(new Set())
        
        if (errors.length > 0) {
          setError(
            t('import.errors.importedPartial', {
              n: imported.length,
              failed: errors.length,
              details: errors.join('; '),
            })
          )
        }
        
        // Limpiar formulario
        setJsonData('')
        setJsonFile(null)
        setJsonPassword('')
        setPassword('')
        setConfirmPassword('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // Redirigir después de 2 segundos
        setTimeout(() => {
          navigate('/accounts')
        }, 2000)
      } else {
        setError(t('import.errors.importAllFailed', { details: errors.join('; ') }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.errors.importBatchFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAccount = (address: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(address)) {
        next.delete(address)
      } else {
        next.add(address)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedAccounts.size === backupAccounts.length) {
      setSelectedAccounts(new Set())
    } else {
      setSelectedAccounts(new Set(backupAccounts.map(acc => acc.address)))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('import.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('import.subtitle')}
        </p>
      </div>

      {!showAccountSelection && (
        <Card>
          <CardHeader>
            <CardTitle>{t('import.methodTitle')}</CardTitle>
            <CardDescription>
              {t('import.methodDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
          <Tabs value={method} onValueChange={(v) => setMethod(v as ImportMethod)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mnemonic">
                <Key className="mr-2 h-4 w-4" />
                {t('import.tabMnemonic')}
              </TabsTrigger>
              <TabsTrigger value="uri">
                <Key className="mr-2 h-4 w-4" />
                {t('import.tabUri')}
              </TabsTrigger>
              <TabsTrigger value="json">
                <FileText className="mr-2 h-4 w-4" />
                {t('import.tabJson')}
              </TabsTrigger>
            </TabsList>

            {/* Frase de Recuperación */}
            <TabsContent value="mnemonic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mnemonic">{t('import.labelMnemonic')}</Label>
                <div className="relative">
                  <Input
                    id="mnemonic"
                    type={showMnemonic ? 'text' : 'password'}
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                    placeholder={t('import.phMnemonic')}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowMnemonic(!showMnemonic)}
                  >
                    {showMnemonic ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('import.mnemonicHelp')}
                </p>
              </div>
            </TabsContent>

            {/* URI / Seed */}
            <TabsContent value="uri" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uri">{t('import.labelUri')}</Label>
                <Input
                  id="uri"
                  type="text"
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder={t('import.phUri')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('import.uriHelp')}
                </p>
              </div>
            </TabsContent>

            {/* Archivo JSON */}
            <TabsContent value="json" className="space-y-4">
              <Alert>
                <AlertTitle>Tipo de criptografía en JSON de Polkadot.js</AlertTitle>
                <AlertDescription className="text-sm">
                  Si el archivo es de Polkadot.js (con <code className="text-xs">address</code> y{' '}
                  <code className="text-xs">encoded</code>), el tipo de par (sr25519, ed25519, ecdsa, ethereum)
                  viene dentro del propio JSON; el selector &quot;Tipo de Criptografía&quot; de abajo no lo
                  cambia. Tras importar, confirme el tipo en la lista de Cuentas (etiqueta junto al nombre).
                </AlertDescription>
              </Alert>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jsonFile">Seleccionar Archivo JSON</Label>
                  <input
                    ref={fileInputRef}
                    id="jsonFile"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setJsonFile(file)
                        setJsonData('') // Limpiar el campo de texto
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {jsonFile ? jsonFile.name : 'Seleccionar Archivo JSON'}
                  </Button>
                  {jsonFile && (
                    <p className="text-xs text-muted-foreground">
                      Archivo seleccionado: {jsonFile.name}
                    </p>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">O</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="json">Pegar Contenido JSON</Label>
                  <textarea
                    id="json"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    value={jsonData}
                    onChange={(e) => {
                      setJsonData(e.target.value)
                      setJsonFile(null) // Limpiar archivo si se pega contenido
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    placeholder='{"address": "...", "encoded": "...", ...} o {"mnemonic": "palabra1 palabra2 ..."}'
                  />
                  <p className="text-xs text-muted-foreground">
                    Soporta archivos JSON de Polkadot.js o JSON simple con mnemonic/uri/seed
                  </p>
                </div>

                {(jsonFile || (jsonData && JSON.parse(jsonData || '{}').address)) && (
                  <div className="space-y-2">
                    <Label htmlFor="jsonPassword">Contraseña del Archivo JSON (Requerida para archivos de Polkadot.js)</Label>
                    <Input
                      id="jsonPassword"
                      type="password"
                      value={jsonPassword}
                      onChange={(e) => setJsonPassword(e.target.value)}
                      placeholder="Contraseña usada al exportar el JSON"
                    />
                    <p className="text-xs text-muted-foreground">
                      Esta es la contraseña que usaste al exportar la cuenta desde Polkadot.js
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}

      {/* Configuración adicional */}
      {!showAccountSelection && (
        <Card>
        <CardHeader>
          <CardTitle>{t('import.configTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Cuenta (Opcional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi Cuenta Recuperada"
            />
          </div>

          {method === 'json' ? (
            <div className="space-y-2">
              <Label>Tipo de criptografía</Label>
              <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                Con JSON de Polkadot.js el tipo viene del archivo. Si el JSON trae solo{' '}
                <code className="text-xs">mnemonic</code> / <code className="text-xs">uri</code>, puede incluir{' '}
                <code className="text-xs">type</code>; si no, se usa <strong>sr25519</strong> para la cuenta guardada.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Derivación</Label>
              <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                Con frase o URI sin JSON, la cuenta se guarda como <strong>sr25519</strong> y en Cuentas verá las
                vistas SS58 <strong>sr25519</strong>, <strong>ed25519</strong>, <strong>ecdsa</strong> y la{' '}
                <strong>0x</strong> EVM (BIP44) derivadas de la misma frase.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña para Proteger la Cuenta (Opcional)</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <p className="text-xs text-muted-foreground">
              Si proporcionas una contraseña, la cuenta se encriptará antes de guardarse
            </p>
          </div>

          {password && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
              />
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Errores y éxito */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* UI de selección de cuentas del backup completo de Polkadot.js */}
      {showAccountSelection && backupAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Seleccionar Cuentas para Importar
            </CardTitle>
            <CardDescription>
              Se encontraron {backupAccounts.length} cuenta(s) en el backup. Selecciona cuáles deseas importar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedAccounts.size === backupAccounts.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedAccounts.size} de {backupAccounts.length} seleccionada(s)
              </span>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {backupAccounts.map((accountData) => {
                const isSelected = selectedAccounts.has(accountData.address)
                return (
                  <div
                    key={accountData.address}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 border-primary' : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => handleToggleAccount(accountData.address)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleAccount(accountData.address)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {accountData.meta?.name || 'Sin nombre'}
                      </div>
                      <div className="text-sm text-muted-foreground font-mono truncate">
                        {accountData.address}
                      </div>
                      {accountData.meta?.genesisHash && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Genesis: {accountData.meta.genesisHash.slice(0, 16)}...
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Campo de contraseña para guardar las cuentas */}
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="backup-password">
                  Contraseña para Proteger las Cuentas {isUnlocked ? '(Opcional)' : '(Requerida)'}
                </Label>
                <Input
                  id="backup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isUnlocked ? "Mínimo 8 caracteres (opcional)" : "Mínimo 8 caracteres (requerida)"}
                />
                <p className="text-xs text-muted-foreground">
                  {isUnlocked 
                    ? "Si proporcionas una contraseña, las cuentas se encriptarán antes de guardarse. Si ya tienes cuentas, usa tu contraseña actual."
                    : "Esta contraseña protegerá y guardará las cuentas importadas. Será tu contraseña principal del wallet."}
                </p>
              </div>

              {password && (
                <div className="space-y-2">
                  <Label htmlFor="backup-confirm-password">Confirmar Contraseña</Label>
                  <Input
                    id="backup-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAccountSelection(false)
                  setBackupAccounts([])
                  setSelectedAccounts(new Set())
                  setPassword('')
                  setConfirmPassword('')
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImportSelectedAccounts}
                disabled={loading || selectedAccounts.size === 0}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Key className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Importar {selectedAccounts.size} Cuenta(s)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {success && importedAddress && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>Cuenta importada exitosamente</strong>
                <p className="text-sm mt-1">Dirección: {importedAddress}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAddress}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Botones de acción */}
      {!showAccountSelection && (
        <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => navigate('/accounts')}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleImport}
          disabled={
            loading || 
            (method === 'mnemonic' && !mnemonic.trim()) ||
            (method === 'uri' && !uri.trim()) ||
            (method === 'json' && !jsonFile && !jsonData.trim())
          }
          className="flex-1"
        >
          {loading ? 'Importando...' : 'Importar Cuenta'}
        </Button>
      </div>
      )}

      {/* Advertencia de seguridad */}
      {!showAccountSelection && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> Asegúrate de estar en un entorno seguro al ingresar tu
            frase de recuperación. Nunca compartas tu frase de recuperación con nadie.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
