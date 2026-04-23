import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadDotenv } from "dotenv"
import type { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@parity/hardhat-polkadot"

const envRoot = resolve(__dirname, "../../.env")
const envLocal = resolve(__dirname, ".env")
if (existsSync(envRoot)) loadDotenv({ path: envRoot, override: false })
if (existsSync(envLocal)) loadDotenv({ path: envLocal, override: true })

/** 32 bytes en hex (64 caráct. hex, con o sin `0x`). Si no, undefined — evita HH8 con `.env` vacío o atajo. */
function secp256k1PrivateKeyHexFromEnv(v: string | undefined): string | undefined {
  if (v == null) return
  const s = v.trim()
  if (!s) return
  const h = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s
  if (h.length !== 64) return
  if (!/^[0-9a-fA-F]+$/.test(h)) return
  return "0x" + h.toLowerCase()
}

/**
 * PVM: `resolc` (usa `solc` como front-end) → bytecode PolkaVM.
 * El plugin `@parity/hardhat-polkadot` trae `hardhat-polkadot-resolc` y ajusta el compile.
 *
 * `CHAIN_ID` debe coincidir con `eth_chainId` del RPC (p. ej. `cast chain-id $RPC_URL`).
 * El ejemplo oficial Parity (all-polkavm-networks) usa 420420422; la doc pública
 * a veces cita 420420417 para el mismo testnet. Si deploy falla por chainId, ajustá env.
 */
const privateKey = secp256k1PrivateKeyHexFromEnv(process.env.PRIVATE_KEY)
const polkadotTestnetUrl =
  process.env.POLKADOT_HUB_TESTNET_URL ?? "https://services.polkadothub-rpc.com/testnet"
const chainId = parseInt(
  process.env.POLKADOT_HUB_CHAIN_ID ?? "420420422",
  10
)

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  resolc: {
    // "binary" descarga `resolc` (release Parity) y no usa pnpm; compatible con
    // la raíz del monorepo que fija `packageManager` yarn.
    version: "0.5.0",
    compilerSource: "binary" as const,
    settings: {
      // Opcional: `solcPath` (bin `solc` o `solcjs`) si resolc no resuelve solc solo.
      optimizer: {
        enabled: true,
        // “z” = mínimo tamaño (análogo a un Honk gordo bajo límite de código)
        parameters: "z" as const,
        runs: 1,
        fallbackOz: true,
      },
    },
  },
  networks: {
    // Necesario para `hardhat compile` local: resolc solo aplica con `polkadot: true` en el network usado a compilar.
    hardhat: {
      polkadot: true,
    },
    polkadotHubTestnet: {
      polkadot: true,
      url: polkadotTestnetUrl,
      chainId,
      accounts: privateKey && privateKey.length > 0 ? [privateKey] : [],
    },
  },
}

export default config
