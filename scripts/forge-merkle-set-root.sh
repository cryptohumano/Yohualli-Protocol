#!/usr/bin/env bash
# Fija setMerkleRoot en YohualliMerkleHonkRegistry. Requiere (en el mismo shell):
#   export RPC_URL=https://eth-rpc-testnet.polkadot.io   # u otro EVM
#   export YOHUALLI_MERKLE_REGISTRY=0x…
#   export MERKLE_ROOT=0x…  # 66 chars; p. ej. de npm run merkle:root:trusted-seed-leaves
#   export MERKLE_EPOCH=0   # opcional; default 0
#   export MNEMONIC="…" o export PRIVATE_KEY=0x…  (mismo owner que el registry)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/evm/yohualli_honk_verifier"

if [[ -z "${RPC_URL:-}" ]]; then
  echo "evm:forge:merkle:set-root: define RPC_URL (p. ej. https://eth-rpc-testnet.polkadot.io)" >&2
  exit 1
fi
if [[ -z "${YOHUALLI_MERKLE_REGISTRY:-}" ]]; then
  echo "evm:forge:merkle:set-root: define YOHUALLI_MERKLE_REGISTRY" >&2
  exit 1
fi
if [[ -z "${MERKLE_ROOT:-}" ]]; then
  echo "evm:forge:merkle:set-root: define MERKLE_ROOT (32 B hex)" >&2
  exit 1
fi

export MERKLE_EPOCH="${MERKLE_EPOCH:-0}"

forge build
exec forge script script/SetMerkleRoot.s.sol:SetMerkleRoot --rpc-url "$RPC_URL" --broadcast -g 500
