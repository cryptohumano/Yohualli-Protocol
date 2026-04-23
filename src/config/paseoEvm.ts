import { defineChain } from 'viem'

/**
 * EVM en Polkadot Hub testnet (pallet revive). Debe coincidir con la red añadida en MetaMask.
 *
 * Valores por defecto (abril 2026): chain ID **420420417**, RPC público `eth-rpc-testnet.polkadot.io`.
 * La red histórica “PassetHub” Paseo usaba **420420422** y otro RPC; si aún la usás, definí
 * `VITE_PASEO_CHAIN_ID`, `VITE_PASEO_RPC_URL` y `VITE_PASEO_EXPLORER_URL` en `.env`.
 */
const defaultChainId = Number(import.meta.env.VITE_PASEO_CHAIN_ID) || 420420417

const defaultRpc =
  import.meta.env.VITE_PASEO_RPC_URL || 'https://eth-rpc-testnet.polkadot.io'

const defaultExplorer =
  import.meta.env.VITE_PASEO_EXPLORER_URL || 'https://blockscout-testnet.polkadot.io'

/** Polkadot Hub Testnet — capa EVM (mismo libro que MetaMask “Polkadot Hub Testnet”). */
export const paseoPassetHub = defineChain({
  id: defaultChainId,
  name: 'Polkadot Hub Testnet',
  nativeCurrency: { name: 'PAS', symbol: 'PAS', decimals: 18 },
  rpcUrls: {
    default: { http: [defaultRpc] },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: defaultExplorer,
    },
  },
})

export function getPaseoRpcUrl(): string {
  return defaultRpc
}
