import { useState, useEffect, useCallback, useMemo } from 'react'
import { DedotClient } from 'dedot'
import { DEFAULT_CHAINS, POLKADOT_HUB_TESTNET_EVM, useDedotClient } from './useDedotClient'
import type { ChainInfo } from './useDedotClient'

export interface AccountBalance {
  chain: string
  chainName: string
  address: string
  free: bigint
  reserved: bigint
  frozen: bigint
  total: bigint
  nonce?: number
  lastUpdate?: number
  /** JSON-RPC HTTP usado (solo redes EVM). */
  rpcUrl?: string
}

export interface MultiChainBalanceResult {
  balances: AccountBalance[]
  isLoading: boolean
  error: string | null
  lastUpdate: number | null
}

async function fetchEvmNativeBalanceWei(rpcHttp: string, evmAddress: string): Promise<bigint> {
  const res = await fetch(rpcHttp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [evmAddress, 'latest'],
    }),
  })
  const json = (await res.json()) as { result?: string; error?: { message?: string } }
  if (json.error?.message) {
    throw new Error(json.error.message)
  }
  if (!json.result || typeof json.result !== 'string') {
    throw new Error('Respuesta RPC inválida para eth_getBalance')
  }
  return BigInt(json.result)
}

/**
 * Hook para obtener balances de una cuenta en múltiples cadenas
 * @param evmBalanceAddress Dirección 0x (BIP44); si se indica, se añade la red EVM de Paseo / Polkadot Hub testnet (`eth_getBalance`).
 */
export function useMultiChainBalances(
  address: string | null,
  chains: ChainInfo[] = DEFAULT_CHAINS,
  evmBalanceAddress?: string | null
): MultiChainBalanceResult {
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  const chainsWithEvm = useMemo(() => {
    const evm = evmBalanceAddress?.trim()
    if (!evm?.startsWith('0x')) return chains
    const already = chains.some((c) => c.endpoint === POLKADOT_HUB_TESTNET_EVM.endpoint)
    if (already) return chains
    return [...chains, POLKADOT_HUB_TESTNET_EVM]
  }, [chains, evmBalanceAddress])

  const fetchBalance = useCallback(
    async (
      chain: ChainInfo,
      substrateSs58: string,
      evmHex: string | null | undefined
    ): Promise<AccountBalance | null> => {
      if (chain.evm) {
        const rpc = chain.evm.rpcHttp
        const hex = evmHex?.trim()
        if (!hex?.startsWith('0x')) return null
        try {
          const wei = await fetchEvmNativeBalanceWei(rpc, hex)
          return {
            chain: chain.endpoint,
            chainName: chain.name,
            address: hex,
            free: wei,
            reserved: BigInt(0),
            frozen: BigInt(0),
            total: wei,
            lastUpdate: Date.now(),
            rpcUrl: rpc,
          }
        } catch (err: unknown) {
          console.error(`Error fetching EVM balance from ${chain.name}:`, err)
          return null
        }
      }

      try {
        const provider = new (await import('dedot')).WsProvider(chain.endpoint)
        await provider.connect()
        const client = await DedotClient.new(provider)

        try {
          const accountInfo = await client.query.system.account(substrateSs58)

          const free = BigInt(accountInfo.data.free?.toString() || '0')
          const reserved = BigInt(accountInfo.data.reserved?.toString() || '0')
          const frozen = BigInt(accountInfo.data.frozen?.toString() || '0')
          const total = free + reserved

          const nonce = accountInfo.nonce ? Number(accountInfo.nonce) : undefined

          await client.disconnect()

          return {
            chain: chain.endpoint,
            chainName: chain.name,
            address: substrateSs58,
            free,
            reserved,
            frozen,
            total,
            nonce,
            lastUpdate: Date.now(),
          }
        } catch (err) {
          await client.disconnect()
          throw err
        }
      } catch (err: unknown) {
        console.error(`Error fetching balance from ${chain.name}:`, err)
        return null
      }
    },
    []
  )

  const fetchAllBalances = useCallback(async () => {
    if (!address) {
      setBalances([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const balancePromises = chainsWithEvm.map((chain) =>
        fetchBalance(chain, address, evmBalanceAddress ?? null)
      )
      const results = await Promise.all(balancePromises)

      const validBalances = results.filter((b): b is AccountBalance => b !== null)

      setBalances(validBalances)
      setLastUpdate(Date.now())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al obtener balances'
      setError(msg)
      console.error('Error fetching multi-chain balances:', err)
    } finally {
      setIsLoading(false)
    }
  }, [address, chainsWithEvm, evmBalanceAddress, fetchBalance])

  useEffect(() => {
    fetchAllBalances()
  }, [fetchAllBalances])

  return {
    balances,
    isLoading,
    error,
    lastUpdate,
  }
}

// Importar useNetwork aquí para evitar dependencia circular
import { useNetwork } from '@/contexts/NetworkContext'

/**
 * Hook simplificado que usa el NetworkContext para obtener balance de la cadena actual
 */
export function useCurrentChainBalance(address: string | null) {
  const { client, selectedChain } = useNetwork()
  const [balance, setBalance] = useState<AccountBalance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!client || !address || !selectedChain) {
      setBalance(null)
      return
    }

    const fetchBalance = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const accountInfo = await client.query.system.account(address)
        
        const free = BigInt(accountInfo.data.free?.toString() || '0')
        const reserved = BigInt(accountInfo.data.reserved?.toString() || '0')
        const frozen = BigInt(accountInfo.data.frozen?.toString() || '0')
        const total = free + reserved
        const nonce = accountInfo.nonce ? Number(accountInfo.nonce) : undefined

        setBalance({
          chain: selectedChain.endpoint,
          chainName: selectedChain.name,
          address,
          free,
          reserved,
          frozen,
          total,
          nonce,
          lastUpdate: Date.now(),
        })
      } catch (err: any) {
        setError(err.message || 'Error al obtener balance')
        console.error('Error fetching balance:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalance()
  }, [client, address, selectedChain])

  return { balance, isLoading, error }
}

