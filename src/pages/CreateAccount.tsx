import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAllEncryptedAccounts, verifyWalletStoragePassword } from '@/utils/secureStorage'

export default function CreateAccount() {
  const navigate = useNavigate()
  const { generateMnemonic, addFromMnemonic, isUnlocked } = useKeyringContext()
  const [step, setStep] = useState<'form' | 'backup' | 'password'>('form')
  const [name, setName] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasOtherStoredAccounts, setHasOtherStoredAccounts] = useState(false)

  useEffect(() => {
    void getAllEncryptedAccounts()
      .then((a) => setHasOtherStoredAccounts(a.length > 0))
      .catch(() => setHasOtherStoredAccounts(false))
  }, [])

  if (!isUnlocked) {
    navigate('/')
    return null
  }

  const handleGenerate = () => {
    const newMnemonic = generateMnemonic()
    setMnemonic(newMnemonic)
    setStep('backup')
  }

  const handleCopyMnemonic = async () => {
    await navigator.clipboard.writeText(mnemonic)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBackupConfirmed = () => {
    setStep('password')
  }

  const handleCreate = async () => {
    setError('')

    if (!name.trim()) {
      setError('El nombre de la cuenta es requerido')
      return
    }

    if (!password) {
      setError('La contraseña es requerida para proteger tu cuenta')
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (hasOtherStoredAccounts) {
      const ok = await verifyWalletStoragePassword(password)
      if (!ok) {
        setError(
          'La contraseña debe ser la misma con la que cifraste y desbloqueas el resto de cuentas en este dispositivo, no una nueva distinta por cuenta.'
        )
        return
      }
    }

    setLoading(true)
    try {
      const account = await addFromMnemonic(mnemonic, name, 'sr25519', password)
      if (account) {
        navigate('/accounts')
      } else {
        setError('Error al crear la cuenta. Por favor intenta de nuevo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'form') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/accounts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Crear Nueva Cuenta</h1>
            <p className="text-muted-foreground mt-1">
              Genera una nueva cuenta con una frase de recuperación
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de la Cuenta</CardTitle>
            <CardDescription>
              Configura los detalles básicos de tu nueva cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Cuenta</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mi Cuenta"
              />
            </div>

            <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
              La cuenta se guarda con par <strong>sr25519</strong> (uso habitual en Substrate). Desde la misma
              frase derivamos y mostramos también las vistas <strong>ed25519</strong>, <strong>ecdsa</strong> (SS58)
              y la dirección <strong>EVM</strong> (BIP44) en Cuentas; no hace falta elegir el tipo a mano.
            </p>

            <Button onClick={handleGenerate} className="w-full" size="lg">
              Generar Nueva Cuenta
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'backup') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setStep('form')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Guarda tu Frase de Recuperación</h1>
            <p className="text-muted-foreground mt-1">
              Esta frase es la única forma de recuperar tu cuenta
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Frase de Recuperación (Mnemonic)</CardTitle>
            <CardDescription>
              Guarda estas 12 palabras en un lugar seguro. Sin esta frase, no podrás
              recuperar tu cuenta si pierdes acceso a este dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 bg-muted rounded-lg border-2 border-dashed">
              {showMnemonic ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {mnemonic.split(' ').map((word, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-6">{index + 1}.</span>
                        <span className="font-mono">{word}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleCopyMnemonic}
                    variant="outline"
                    className="w-full"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar al Portapapeles
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Button onClick={() => setShowMnemonic(true)} variant="outline" size="lg">
                    Mostrar Frase de Recuperación
                  </Button>
                </div>
              )}
            </div>

            {showMnemonic && (
              <Alert>
                <AlertDescription>
                  <strong>⚠️ Advertencia:</strong> No compartas esta frase con nadie.
                  Cualquiera que tenga acceso a estas palabras puede controlar tu cuenta.
                  Guárdala en un lugar seguro y nunca la compartas.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('form')}
                variant="outline"
                className="flex-1"
              >
                Atrás
              </Button>
              <Button
                onClick={handleBackupConfirmed}
                className="flex-1"
                disabled={!showMnemonic}
              >
                He Guardado la Frase
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'password') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setStep('backup')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configurar Contraseña</h1>
            <p className="text-muted-foreground mt-1">
              Protege tu cuenta con una contraseña segura
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contraseña de Seguridad</CardTitle>
            <CardDescription>
              {hasOtherStoredAccounts
                ? 'Indica la misma contraseña con la que ya cifraste y desbloqueas el resto de cuentas en este dispositivo. Todas las cuentas comparten una sola clave de cifrado (IndexedDB).'
                : 'Esta contraseña se usará para encriptar y proteger tu cuenta en este dispositivo'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

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

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('backup')}
                variant="outline"
                className="flex-1"
              >
                Atrás
              </Button>
              <Button
                onClick={handleCreate}
                className="flex-1"
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? 'Creando...' : 'Crear Cuenta'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

