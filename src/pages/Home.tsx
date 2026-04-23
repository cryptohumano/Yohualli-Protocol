import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wallet, Send, QrCode, ArrowRight, Copy, Check, Download, Key, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useState, useEffect } from 'react'
import Identicon from '@polkadot/react-identicon'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useNetwork } from '@/contexts/NetworkContext'
import { formatBalanceForDisplay, getChainSymbol } from '@/utils/balance'
import { getAllTransactions, type StoredTransaction } from '@/utils/transactionStorage'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale/es'
import { EvmPasBalanceCard } from '@/components/EvmPasBalanceCard'

export default function Home() {
  const { accounts } = useKeyringContext()
  const { selectedChain } = useNetwork()
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [totalBalance, setTotalBalance] = useState<bigint>(BigInt(0))
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [recentTransactions, setRecentTransactions] = useState<StoredTransaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)

  const isEvmNetwork = Boolean(selectedChain?.evm)

  // Calcular balance total de todas las cuentas (solo capa Substrate)
  useEffect(() => {
    if (accounts.length === 0 || !selectedChain || isEvmNetwork) {
      setTotalBalance(BigInt(0))
      if (isEvmNetwork) setIsLoadingBalance(false)
      return
    }

    setIsLoadingBalance(true)
    const fetchBalances = async () => {
      try {
        const balances = await Promise.all(
          accounts.map(async (account) => {
            try {
              const provider = new (await import('dedot')).WsProvider(selectedChain.endpoint)
              await provider.connect()
              const client = await (await import('dedot')).DedotClient.new(provider)
              
              const accountInfo = await client.query.system.account(account.address)
              const total = BigInt(accountInfo.data.free?.toString() || '0') + 
                           BigInt(accountInfo.data.reserved?.toString() || '0')
              
              await client.disconnect()
              return total
            } catch (error) {
              console.error(`Error fetching balance for ${account.address}:`, error)
              return BigInt(0)
            }
          })
        )
        
        const total = balances.reduce((acc, balance) => acc + balance, BigInt(0))
        setTotalBalance(total)
      } catch (error) {
        console.error('Error calculating total balance:', error)
        setTotalBalance(BigInt(0))
      } finally {
        setIsLoadingBalance(false)
      }
    }

    fetchBalances()
  }, [accounts, selectedChain, isEvmNetwork])

  // Cargar transacciones recientes
  useEffect(() => {
    setIsLoadingTransactions(true)
    getAllTransactions()
      .then((transactions) => {
        // Filtrar solo transacciones de las cuentas actuales
        const accountAddresses = new Set(accounts.map(acc => acc.address))
        const filtered = transactions
          .filter(tx => accountAddresses.has(tx.accountAddress))
          .slice(0, 5) // Solo las 5 más recientes
        setRecentTransactions(filtered)
      })
      .catch((error) => {
        console.error('Error loading transactions:', error)
        setRecentTransactions([])
      })
      .finally(() => {
        setIsLoadingTransactions(false)
      })
  }, [accounts])

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  const formatTransactionDate = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { 
        addSuffix: true, 
        locale: es 
      })
    } catch {
      return 'Fecha desconocida'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Yohualli Protocol</h1>
        <p className="text-muted-foreground mt-2">
          Tu wallet criptográfica con capacidades avanzadas
        </p>
      </div>

      {/* Balance Total (Substrate) */}
      <Card>
        <CardHeader>
          <CardTitle>Balance total (Substrate)</CardTitle>
          <CardDescription>
            Suma de tus cuentas del keyring en la red Substrate elegida en el selector
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEvmNetwork ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Tenés seleccionada la red <strong>Polkadot Hub Testnet (EVM)</strong>: aquí no aplica el
                saldo Substrate. El PAS nativo de esa red está en la tarjeta de abajo (MetaMask / capa
                Ethereum).
              </p>
            </div>
          ) : isLoadingBalance ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Cargando saldo…</span>
            </div>
          ) : (
            <>
              <div className="text-4xl font-bold">
                {selectedChain
                  ? formatBalanceForDisplay(totalBalance, selectedChain.name)
                  : '0.00 DOT'}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {selectedChain
                  ? `En ${selectedChain.name}`
                  : 'Elegí una red para ver el saldo'}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <EvmPasBalanceCard />

      {/* Acciones Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Envía tokens a otra dirección
            </p>
            <Button asChild className="w-full">
              <Link to="/send">
                Enviar Fondos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Recibir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Muestra tu dirección para recibir fondos
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/receive">
                Recibir Fondos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Cuentas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Gestiona tus cuentas y direcciones
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/accounts">
                Ver Cuentas
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cuentas Activas */}
      <Card>
        <CardHeader>
          <CardTitle>Cuentas Activas</CardTitle>
          <CardDescription>
            {accounts.length > 0 
              ? `${accounts.length} cuenta${accounts.length > 1 ? 's' : ''} configurada${accounts.length > 1 ? 's' : ''}`
              : 'Gestiona tus cuentas del keyring'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-muted-foreground">
                <p className="mb-4">No hay cuentas configuradas aún</p>
                <p className="text-sm mb-6">Puedes crear una nueva cuenta o importar una existente</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild>
                  <Link to="/accounts/create">
                    <Key className="mr-2 h-4 w-4" />
                    Crear Nueva Cuenta
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/accounts/import">
                    <Download className="mr-2 h-4 w-4" />
                    Importar Cuenta
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.address}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <Identicon
                        value={account.address}
                        size={40}
                        theme="polkadot"
                      />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">
                          {account.meta.name || 'Sin nombre'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground font-mono">
                          {formatAddress(account.address)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopyAddress(account.address)}
                        >
                          {copiedAddress === account.address ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/accounts/${account.address}`}>Ver</Link>
                  </Button>
                </div>
              ))}
              <Button asChild variant="outline" className="w-full mt-4">
                <Link to="/accounts">
                  Ver todas las cuentas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transacciones Recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
          <CardDescription>Últimas transacciones realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay transacciones aún</p>
              <Button asChild variant="link" className="mt-4">
                <Link to="/transactions">Ver todas las transacciones</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-2 w-2 rounded-full ${
                      tx.status === 'finalized' ? 'bg-green-500' :
                      tx.status === 'inBlock' ? 'bg-blue-500' :
                      tx.status === 'pending' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {tx.type === 'transfer' || tx.type === 'transferKeepAlive' ? 'Transferencia' : 'Transacción'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          tx.status === 'finalized' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          tx.status === 'inBlock' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                        }`}>
                          {tx.status === 'finalized' ? 'Completada' :
                           tx.status === 'inBlock' ? 'En bloque' :
                           tx.status === 'pending' ? 'Pendiente' :
                           tx.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tx.chain} • {formatTransactionDate(tx.createdAt)}
                      </div>
                      {tx.amount && (
                        <div className="text-xs font-mono text-muted-foreground mt-1">
                          {formatBalanceForDisplay(BigInt(tx.amount), tx.chain)}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/transactions?tx=${tx.txHash}`}>Ver</Link>
                  </Button>
                </div>
              ))}
              <Button asChild variant="outline" className="w-full mt-4">
                <Link to="/transactions">
                  Ver todas las transacciones
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

