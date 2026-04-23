import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPublicClient, createWalletClient, custom, http, type Address } from 'viem'
import { paseoPassetHub, getPaseoRpcUrl } from '@/config/paseoEvm'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

/**
 * Cliente RPC público (lecturas) + wallet EIP-1193 (MetaMask, Rabby, etc.) para Polkadot Hub testnet EVM.
 * El PAS para gas en la capa EVM (pallet revive / `eth`) se consulta con `getBalance`, no con
 * `system.account` de Substrate: el balance de la pantalla principal es otra cosa.
 */
export function usePaseoEvmWallet() {
  const [address, setAddress] = useState<Address | undefined>()
  const [connectError, setConnectError] = useState<string | null>(null)
  const [nativePasWei, setNativePasWei] = useState<bigint | null>(null)
  const [nativePasLoading, setNativePasLoading] = useState(false)
  const [nativePasError, setNativePasError] = useState<string | null>(null)

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: paseoPassetHub,
        transport: http(getPaseoRpcUrl()),
      }),
    []
  )

  const walletClient = useMemo(() => {
    if (typeof window === 'undefined' || !window.ethereum) return undefined
    return createWalletClient({
      chain: paseoPassetHub,
      transport: custom(window.ethereum),
    })
  }, [])

  const connect = useCallback(async () => {
    setConnectError(null)
    if (!window.ethereum) {
      setConnectError('No hay proveedor EVM (instalá MetaMask o una wallet compatible).')
      return
    }
    if (!walletClient) {
      setConnectError('Wallet no disponible.')
      return
    }
    try {
      const chainIdHex = `0x${paseoPassetHub.id.toString(16)}`
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch (e: unknown) {
        const err = e as { code?: number }
        if (err.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: paseoPassetHub.name,
                nativeCurrency: paseoPassetHub.nativeCurrency,
                rpcUrls: [getPaseoRpcUrl()],
                blockExplorerUrls: [paseoPassetHub.blockExplorers.default.url],
              },
            ],
          })
        } else {
          throw e
        }
      }
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]
      const first = accounts[0] as Address
      setAddress(first)
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e))
    }
  }, [walletClient])

  const refetchNativePasBalance = useCallback(async () => {
    if (!address) {
      setNativePasWei(null)
      setNativePasError(null)
      return
    }
    setNativePasLoading(true)
    setNativePasError(null)
    try {
      const wei = await publicClient.getBalance({ address })
      setNativePasWei(wei)
    } catch (e) {
      setNativePasError(e instanceof Error ? e.message : String(e))
      setNativePasWei(null)
    } finally {
      setNativePasLoading(false)
    }
  }, [address, publicClient])

  useEffect(() => {
    void refetchNativePasBalance()
  }, [refetchNativePasBalance])

  return {
    address,
    publicClient,
    walletClient,
    hasInjectedProvider: typeof window !== 'undefined' && !!window.ethereum,
    connect,
    connectError,
    /** Saldo nativo EVM (PAS, 18 decimales) — `eth_getBalance`, no Substrate. */
    nativePasWei,
    nativePasLoading,
    nativePasError,
    refetchNativePasBalance,
  }
}
