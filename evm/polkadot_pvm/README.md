# PVM (resolc + `solc` front-end)

[Polkadot `resolc`](https://github.com/paritytech/revive) toma Yul/LLVM y genera **PolkaVM**; en Hardhat, `@parity/hardhat-polkadot` aplica un compile que sustituye el de EVM cuando `networks.hardhat.polkadot: true` (y la red de despliegue es `polkadot: true`).

## Yarn 4 (Corepack)

Este directorio es un **proyecto Yarn aparte** (su `yarn.lock` aísla de la raíz). En la **raíz del repo** usad **`yarn pvm:compile`** (no `npm run …`) para alinear con `packageManager: "yarn@4.6.0"…` y evitar el *warning* de npm sobre el campo `packageManager`.

- En esta carpeta: `corepack enable` una vez, luego `yarn install` / `yarn hardhat …`.

## Requisitos

- Node 20+ (LTS)
- Cuenta con moneda de test: [faucet](https://docs.polkadot.com/smart-contracts/cookbook/get-tokens-faucet/) según el Hub
- `PRIVATE_KEY`: **64** dígitos hex (32 bytes) con o sin `0x`. Cualquier otro valor se ignora: Hardhat deja de rechazar con HH8, pero el deploy pide clave.  
  `hardhat.config.ts` carga primero el `.env` de la **raíz** y después `evm/polkadot_pvm/.env` (pisa claves con el mismo nombre). **Nunca** subis claves a git.

## Puesta a marcha

```bash
# desde la raíz del repositorio
yarn pvm:compile
# con PRIVATE_KEY válida en .env
yarn pvm:deploy:probe
```

- `hardhat compile` compila a artefacto `_format: hh-resolc-artifact-1` (bytecode `0x50564d…` = PVM).
- Si `eth_chainId` del RPC no coincide con [hardhat.config.ts](./hardhat.config.ts) (`POLKADOT_HUB_CHAIN_ID`, por defecto 420420422 al estilo [ejemplo Parity](https://github.com/paritytech/hardhat-polkadot/blob/main/examples/all-polkavm-networks/hardhat.config.ts)), ajustad la variable y volved a probar. Con la misma URL, `cast chain-id` debe coincidir con `chainId` de Hardhat.

## Convivir con `evm/yohualli_honk_verifier/`

- **Foundry** sigue siendo la pila EVM/REVM; esta carpeta es el camino PVM. Podés **copiar** o enlazar `src/*.sol` poco a poco; `HonkVerifier` es grande: validad primero que resolc lo admite (posible ajuste de `optimizer` / [límites PVM](https://paritytech.github.io/revive/user_guide/differences.html)).

## Referencia

- [Despliegue: REVM vs PVM](https://docs.polkadot.com/smart-contracts/for-eth-devs/contract-deployment/)
- [Hardhat Polkadot (Parity)](https://github.com/paritytech/hardhat-polkadot)
