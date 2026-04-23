#!/usr/bin/env bash
# Copia el verificador Solidity generado por Barretenberg al paquete Foundry.
# Prerrequisitos en el directorio del circuito:
#   nargo compile && bb write_vk -b ./target/*.json -o ./target -t evm
#   bb write_solidity_verifier -k ./target/vk -o ./target/Verifier.sol -t evm
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/circuits/yohualli_one_attest_sig/target/Verifier.sol"
DST="$ROOT/evm/yohualli_honk_verifier/src/HonkVerifier.sol"
if [[ ! -f "$SRC" ]]; then
  echo "No existe $SRC — generá primero el .sol con bb write_solidity_verifier." >&2
  exit 1
fi
cp "$SRC" "$DST"
echo "Copiado a $DST"
echo "Siguiente: cd evm/yohualli_honk_verifier && forge build"
