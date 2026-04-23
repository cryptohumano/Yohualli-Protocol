import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePaseoEvmWallet } from '@/hooks/usePaseoEvmWallet'
import { paseoPassetHub } from '@/config/paseoEvm'
import { formatEther } from 'viem'
import { FlaskConical, Loader2 } from 'lucide-react'

/**
 * PAS nativo en la capa EVM (Polkadot Hub testnet / revive). Independiente del balance Substrate.
 */
export function EvmPasBalanceCard() {
  const {
    address,
    hasInjectedProvider,
    connect,
    connectError,
    nativePasWei,
    nativePasLoading,
    nativePasError,
    refetchNativePasBalance,
  } = usePaseoEvmWallet()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          PAS (capa EVM)
        </CardTitle>
        <CardDescription>
          Mismo libro que en MetaMask: chain ID {paseoPassetHub.id}, gas en PAS. No es el saldo
          Substrate de arriba.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasInjectedProvider && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No hay proveedor EVM (<code className="text-xs">window.ethereum</code>). Usá un navegador
            con MetaMask o abrí la app desde la wallet.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => void connect()} disabled={!hasInjectedProvider}>
            Conectar cartera
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetchNativePasBalance()}
            disabled={!address || nativePasLoading}
          >
            {nativePasLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/zk-lab" className="gap-1">
              <FlaskConical className="h-4 w-4" />
              ZK Lab
            </Link>
          </Button>
        </div>
        {address && (
          <p className="text-xs font-mono text-muted-foreground break-all">{address}</p>
        )}
        {connectError && <p className="text-sm text-destructive">{connectError}</p>}
        {address && (
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            {nativePasLoading ? (
              <p className="text-sm text-muted-foreground">Cargando saldo…</p>
            ) : nativePasError ? (
              <p className="text-sm text-destructive">{nativePasError}</p>
            ) : nativePasWei !== null ? (
              <p className="text-2xl font-semibold tabular-nums">
                {formatEther(nativePasWei)}{' '}
                <span className="text-base font-normal text-muted-foreground">PAS</span>
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
