import { useEffect, useState } from 'react'
import { DedotClient, WsProvider } from 'dedot'
import { paseoPassetHub, getPaseoRpcUrl } from '@/config/paseoEvm'

export interface ChainInfo {
  name: string
  endpoint: string
  description?: string
  /** Si existe, es red solo EVM (JSON-RPC); no usar con Dedot/WebSocket Substrate. */
  evm?: {
    chainId: number
    rpcHttp: string
    explorerUrl: string
    symbol: string
  }
}

/** Paseo / Polkadot Hub testnet — capa EVM (JSON-RPC), mismo chain ID y RPC que MetaMask. */
export const POLKADOT_HUB_TESTNET_EVM: ChainInfo = {
  name: 'Paseo EVM (Polkadot Hub testnet)',
  endpoint: 'evm:polkadot-hub-testnet',
  description: 'Ethereum JSON-RPC (Paseo testnet), gas nativo PAS; ver `getPaseoRpcUrl()`',
  evm: {
    chainId: paseoPassetHub.id,
    rpcHttp: getPaseoRpcUrl(),
    explorerUrl: paseoPassetHub.blockExplorers.default.url,
    symbol: 'PAS',
  },
}

export const DEFAULT_CHAINS: ChainInfo[] = [
  {
    name: 'Polkadot',
    endpoint: 'wss://rpc.ibp.network/polkadot',
    description: 'Red principal de Polkadot (IBP)'
  },
  {
    name: 'Kusama',
    endpoint: 'wss://rpc.ibp.network/kusama',
    description: 'Red canary de Polkadot (IBP)'
  },
  {
    name: 'Paseo Relay Chain',
    endpoint: 'wss://rpc.ibp.network/paseo',
    description: 'Paseo Relay Chain - Testnet de Polkadot'
  },
  {
    name: 'Asset Hub (Paseo)',
    endpoint: 'wss://sys.ibp.network/asset-hub-paseo',
    description: 'Asset Hub de Paseo - Gestión de activos y NFTs'
  },
  {
    name: 'Bridge Hub (Paseo)',
    endpoint: 'wss://sys.ibp.network/bridgehub-paseo',
    description: 'Bridge Hub de Paseo - Puentes entre cadenas'
  },
  {
    name: 'Coretime (Paseo)',
    endpoint: 'wss://sys.ibp.network/coretime-paseo',
    description: 'Coretime Chain de Paseo - Gestión de coretime'
  },
  {
    name: 'People (Paseo)',
    endpoint: 'wss://sys.ibp.network/people-paseo',
    description: 'People Chain de Paseo - Sistema de identidad'
  },
  {
    name: 'Collectives (Paseo)',
    endpoint: 'wss://sys.ibp.network/collectives-paseo',
    description: 'Collectives Chain de Paseo - Gobernanza y colectivos'
  },
  {
    name: 'Asset Hub (Polkadot)',
    endpoint: 'wss://sys.ibp.network/asset-hub-polkadot',
    description: 'Asset Hub de Polkadot - Gestión de activos y NFTs (IBP)'
  },
  {
    name: 'Asset Hub (Kusama)',
    endpoint: 'wss://sys.ibp.network/asset-hub-kusama',
    description: 'Asset Hub de Kusama - Gestión de activos y NFTs (IBP)'
  },
  {
    name: 'People Chain (Polkadot)',
    endpoint: 'wss://sys.ibp.network/people-polkadot',
    description: 'People Chain de Polkadot - Sistema de identidad (IBP)'
  },
  {
    name: 'People Chain (Kusama)',
    endpoint: 'wss://sys.ibp.network/people-kusama',
    description: 'People Chain de Kusama - Sistema de identidad (IBP)'
  },
  {
    name: 'Bridge Hub (Polkadot)',
    endpoint: 'wss://sys.ibp.network/bridgehub-polkadot',
    description: 'Bridge Hub de Polkadot - Puentes entre cadenas (IBP)'
  },
  {
    name: 'Coretime (Polkadot)',
    endpoint: 'wss://sys.ibp.network/coretime-polkadot',
    description: 'Coretime Chain de Polkadot - Gestión de coretime (IBP)'
  },
  {
    name: 'Collectives (Polkadot)',
    endpoint: 'wss://sys.ibp.network/collectives-polkadot',
    description: 'Collectives Chain de Polkadot - Gobernanza y colectivos (IBP)'
  }
]

/** Substrate + opción EVM para el selector de red. */
export const NETWORK_OPTIONS: ChainInfo[] = [...DEFAULT_CHAINS, POLKADOT_HUB_TESTNET_EVM]

// Endpoints alternativos para cadenas conocidas
// Usando IBP (Infrastructure Builders' Programme) como principal y dotters.network como fallback
// Referencia: https://wiki.ibp.network/docs/consumers/archives
const FALLBACK_ENDPOINTS: Record<string, string[]> = {
  // Polkadot Relay Chain
  'wss://rpc.ibp.network/polkadot': [
    'wss://polkadot.dotters.network',
    'wss://rpc.polkadot.io',
  ],
  // Kusama Relay Chain
  'wss://rpc.ibp.network/kusama': [
    'wss://kusama.dotters.network',
    'wss://kusama-rpc.polkadot.io',
  ],
  // Asset Hub (Polkadot)
  'wss://sys.ibp.network/asset-hub-polkadot': [
    'wss://asset-hub-polkadot.dotters.network',
    'wss://polkadot-asset-hub-rpc.polkadot.io',
    'wss://statemint-rpc.polkadot.io',
  ],
  // Asset Hub (Kusama)
  'wss://sys.ibp.network/asset-hub-kusama': [
    'wss://asset-hub-kusama.dotters.network',
    'wss://kusama-asset-hub-rpc.polkadot.io',
    'wss://statemine-rpc.polkadot.io',
  ],
  // People Chain (Polkadot)
  'wss://sys.ibp.network/people-polkadot': [
    'wss://people-polkadot.dotters.network',
    'wss://polkadot-people-rpc.polkadot.io',
  ],
  // People Chain (Kusama)
  'wss://sys.ibp.network/people-kusama': [
    'wss://people-kusama.dotters.network',
    'wss://kusama-people-rpc.polkadot.io',
  ],
  // Bridge Hub (Polkadot)
  'wss://sys.ibp.network/bridgehub-polkadot': [
    'wss://bridge-hub-polkadot.dotters.network',
  ],
  // Coretime (Polkadot)
  'wss://sys.ibp.network/coretime-polkadot': [
    'wss://coretime-polkadot.dotters.network',
  ],
  // Collectives (Polkadot)
  'wss://sys.ibp.network/collectives-polkadot': [
    'wss://collectives-polkadot.dotters.network',
  ],
  // Paseo Relay Chain
  'wss://rpc.ibp.network/paseo': [
    'wss://paseo.dotters.network',
  ],
  // Asset Hub (Paseo)
  'wss://sys.ibp.network/asset-hub-paseo': [
    'wss://asset-hub-paseo.dotters.network',
  ],
  // Bridge Hub (Paseo)
  'wss://sys.ibp.network/bridgehub-paseo': [
    'wss://bridge-hub-paseo.dotters.network',
  ],
  // Coretime (Paseo)
  'wss://sys.ibp.network/coretime-paseo': [
    'wss://coretime-paseo.dotters.network',
  ],
  // People (Paseo)
  'wss://sys.ibp.network/people-paseo': [
    'wss://people-paseo.dotters.network',
  ],
  // Collectives (Paseo)
  'wss://sys.ibp.network/collectives-paseo': [
    'wss://collectives-paseo.dotters.network',
  ],
}

async function tryConnectWithFallback(
  primaryEndpoint: string,
  fallbacks: string[] = []
): Promise<{ client: DedotClient; endpoint: string }> {
  const allEndpoints = [primaryEndpoint, ...fallbacks]
  let lastError: Error | null = null

  for (const endpoint of allEndpoints) {
    try {
      const provider = new WsProvider(endpoint)
      await provider.connect()
      
      // Crear el cliente con manejo de errores
      // El error "Cannot read properties of undefined (reading 'hash')" 
      // puede ocurrir en eventos de seguimiento internos de Dedot
      // Estos errores no afectan la funcionalidad principal, así que los ignoramos
      const client = await DedotClient.new(provider)
      
      // Agregar un manejador de errores no capturados para eventos internos
      // Esto previene que errores internos de Dedot rompan la aplicación
      if (typeof window !== 'undefined') {
        const originalErrorHandler = window.onerror
        window.onerror = (message, source, lineno, colno, error) => {
          // Ignorar errores específicos de Dedot relacionados con 'hash' y 'onFollowEvent'
          if (
            (typeof message === 'string' && message.includes('hash') && message.includes('onFollowEvent')) ||
            (error?.message?.includes('hash') && error?.stack?.includes('onFollowEvent'))
          ) {
            console.warn('[DedotClient] ⚠️ Error interno de Dedot ignorado:', message)
            return true // Prevenir que el error se propague
          }
          // Llamar al manejador original para otros errores
          if (originalErrorHandler) {
            return originalErrorHandler(message, source, lineno, colno, error)
          }
          return false
        }
      }
      
      console.log(`[DedotClient] ✅ Conectado a ${endpoint}`)
      return { client, endpoint }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      // Ignorar errores específicos de eventos internos de Dedot
      if (
        lastError.message.includes('hash') && 
        (lastError.stack?.includes('onFollowEvent') || lastError.message.includes('onFollowEvent'))
      ) {
        console.warn(`[DedotClient] ⚠️ Error interno de Dedot al conectar a ${endpoint} (continuando):`, lastError.message)
        continue
      }
      console.warn(`[DedotClient] ⚠️ Error al conectar a ${endpoint}:`, lastError.message)
      // Continuar con el siguiente endpoint
    }
  }

  throw lastError || new Error('No se pudo conectar a ningún endpoint')
}

export function useDedotClient(endpoint: string | null) {
  const [client, setClient] = useState<DedotClient | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectedEndpoint, setConnectedEndpoint] = useState<string | null>(null)

  useEffect(() => {
    if (!endpoint) {
      setClient(null)
      setConnectedEndpoint(null)
      setIsConnecting(false)
      setError(null)
      return
    }

    setIsConnecting(true)
    setError(null)

    const fallbacks = FALLBACK_ENDPOINTS[endpoint] || []
    let newClient: DedotClient | null = null

    tryConnectWithFallback(endpoint, fallbacks)
      .then(({ client: connectedClient, endpoint: connectedEndpoint }) => {
        newClient = connectedClient
        setClient(connectedClient)
        setConnectedEndpoint(connectedEndpoint)
        setIsConnecting(false)
      })
      .catch((err) => {
        const errorMessage = err.message || 'Error al conectar'
        setError(errorMessage)
        setIsConnecting(false)
        setClient(null)
        setConnectedEndpoint(null)
        console.error(`[DedotClient] ❌ Error al conectar a ${endpoint}:`, errorMessage)
      })

    return () => {
      if (newClient) {
        newClient.disconnect().catch(() => {})
      }
    }
  }, [endpoint])

  return { client, isConnecting, error, connectedEndpoint }
}

