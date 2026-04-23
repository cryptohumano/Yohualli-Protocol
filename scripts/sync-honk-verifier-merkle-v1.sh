#!/usr/bin/env bash
# Copia HonkVerifier generado desde yohualli_merkle_attest_v1 (Barretenberg) al paquete Foundry.
# Requiere: nargo execute && bb prove ... (ver evm/yohualli_honk_verifier/README.md) y
#   bb write_solidity_verifier -k target/proof/vk -o target/Verifier.sol -t evm
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/circuits/yohualli_merkle_attest_v1/target/Verifier.sol"
DST="$ROOT/evm/yohualli_honk_verifier/src/HonkVerifier.sol"
if [[ ! -f "$SRC" ]]; then
  echo "No existe $SRC — generá Verifier.sol con bb write_solidity_verifier (circuito yohualli_merkle_attest_v1)." >&2
  exit 1
fi
cp "$SRC" "$DST"
echo "Copiado a $DST"
echo "Siguiente: cd evm/yohualli_honk_verifier && forge build && ( npm run evm:forge:honk && npm run evm:forge:merkle:set-honk )"
