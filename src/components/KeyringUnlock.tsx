import { useState, useEffect } from 'react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Unlock, AlertCircle, Fingerprint } from 'lucide-react'
import { getAllWebAuthnCredentials } from '@/utils/webauthnStorage'
import type { WebAuthnCredential } from '@/utils/webauthn'

export function KeyringUnlock() {
  const { isUnlocked, hasStoredAccounts, hasWebAuthnCredentials, unlock, unlockWithWebAuthn, lock, isReady } = useKeyringContext()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [webauthnCredentials, setWebauthnCredentials] = useState<WebAuthnCredential[]>([])
  const [isWebAuthnLoading, setIsWebAuthnLoading] = useState(false)

  // Cargar credenciales al montar el componente
  useEffect(() => {
    loadWebAuthnCredentials()
  }, [])
  
  // También cargar cuando cambie el estado del contexto
  useEffect(() => {
    if (hasWebAuthnCredentials) {
      loadWebAuthnCredentials()
    }
  }, [hasWebAuthnCredentials])

  const loadWebAuthnCredentials = async () => {
    try {
      const creds = await getAllWebAuthnCredentials()
      console.log('[KeyringUnlock] Credenciales WebAuthn cargadas:', creds.length)
      setWebauthnCredentials(creds)
    } catch (err) {
      console.error('[KeyringUnlock] Error al cargar credenciales WebAuthn:', err)
      setWebauthnCredentials([])
    }
  }

  const handleWebAuthnUnlock = async (credentialId: string) => {
    setIsWebAuthnLoading(true)
    setError(null)

    try {
      const success = await unlockWithWebAuthn(credentialId)
      if (!success) {
        setError('Error al autenticar con WebAuthn')
      }
    } catch (err: any) {
      setError(err.message || 'Error al desbloquear con WebAuthn')
    } finally {
      setIsWebAuthnLoading(false)
    }
  }

  // Si el keyring no está listo, mostrar un mensaje
  if (!isReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Estado del Keyring
          </CardTitle>
          <CardDescription>
            Inicializando keyring...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError('Por favor ingresa una contraseña')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await unlock(password)
      if (!success) {
        setError('Contraseña incorrecta')
        setPassword('')
      } else {
        setPassword('')
      }
    } catch (err: any) {
      setError(err.message || 'Error al desbloquear el keyring')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLock = () => {
    lock()
    setPassword('')
    setError(null)
  }

  if (isUnlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-green-600" />
            Keyring Desbloqueado
          </CardTitle>
          <CardDescription>
            Tus cuentas están cargadas y disponibles para operaciones criptográficas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLock} variant="outline" className="w-full">
            <Lock className="h-4 w-4 mr-2" />
            Bloquear Keyring
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Al bloquear, las claves privadas se eliminarán de la memoria
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!hasStoredAccounts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Estado del Keyring
          </CardTitle>
          <CardDescription>
            No hay cuentas almacenadas. Desbloquea el keyring para crear tu primera cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!isLoading && password.trim()) void handleUnlock()
            }}
          >
            <div className="space-y-2">
              <Input
                name="password"
                autoComplete="new-password"
                type="password"
                placeholder="Contraseña (cualquiera, para desbloquear y crear tu primera cuenta)"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                disabled={isLoading}
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full"
            >
              {isLoading ? 'Desbloqueando...' : 'Desbloquear para Crear Primera Cuenta'}
            </Button>
          </form>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Nota:</strong> Como no hay cuentas almacenadas, puedes usar cualquier contraseña para desbloquear.
              Esta contraseña se usará para encriptar tu primera cuenta cuando la crees.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-yellow-200 dark:border-yellow-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Desbloquear Keyring
        </CardTitle>
        <CardDescription>
          {webauthnCredentials.length > 0 
            ? 'Usa autenticación biométrica o contraseña para cargar tus cuentas almacenadas'
            : 'Ingresa tu contraseña para cargar tus cuentas almacenadas'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mostrar WebAuthn primero si hay credenciales disponibles */}
        {webauthnCredentials.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Autenticación Biométrica
            </div>
            {webauthnCredentials.map((credential) => (
              <Button
                key={credential.id}
                onClick={() => handleWebAuthnUnlock(credential.id)}
                disabled={isWebAuthnLoading || isLoading}
                variant="outline"
                className="w-full"
              >
                <Fingerprint className="h-4 w-4 mr-2" />
                {isWebAuthnLoading ? 'Autenticando...' : `Desbloquear con ${credential.name || 'WebAuthn'}`}
              </Button>
            ))}
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O</span>
              </div>
            </div>
          </div>
        )}

        {/* Opción con contraseña */}
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!isLoading && !isWebAuthnLoading && password.trim()) void handleUnlock()
          }}
        >
          <div className="text-sm font-medium text-muted-foreground">
            {webauthnCredentials.length > 0 ? 'Contraseña' : 'Desbloquear con Contraseña'}
          </div>
          <Input
            name="password"
            autoComplete="current-password"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            disabled={isLoading || isWebAuthnLoading}
          />
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={isLoading || isWebAuthnLoading || !password.trim()}
            className="w-full"
          >
            {isLoading ? 'Desbloqueando...' : 'Desbloquear con Contraseña'}
          </Button>
        </form>

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Seguridad:</strong> Las claves privadas están encriptadas y almacenadas localmente en IndexedDB.
            Puedes usar contraseña o autenticación biométrica (WebAuthn) para desbloquear.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

