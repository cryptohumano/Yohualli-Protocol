// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";

/**
 * @title Despliegue del verificador Honk generado por `bb write_solidity_verifier` (p. ej. yohualli_merkle_attest_v1: `verifier:sync:honk:merkle-v1`); v0: `yohualli_one_attest_sig` + `sync-honk-verifier-solidity.sh`.
 *
 * Uso:
 *   cd evm/yohualli_honk_verifier
 *   forge script script/DeployHonkVerifier.s.sol:DeployHonkVerifier --rpc-url $RPC_URL --broadcast
 *
 * Cuenta de despliegue — elige **una** de estas formas:
 *
 * 1) Mnemónico (BIP-39) + índice: `vm.deriveKey` usa por defecto la ruta estándar EVM
 *    `m/44'/60'/0'/0/{ACCOUNT_INDEX}` (mismo esquema que muchas wallets “Ethereum account N”).
 *    export MNEMONIC="word1 word2 ... word12"
 *    export ACCOUNT_INDEX=0
 *
 * 2) Ruta de derivación custom (sufijo + índice): el cheatcode deriva en `{ACCOUNT_DERIVATION_PATH}{ACCOUNT_INDEX}`.
 *    export MNEMONIC="..."
 *    export ACCOUNT_DERIVATION_PATH="m/44'/60'/0'/0/"
 *    export ACCOUNT_INDEX=0
 *
 * 3) Clave cruda: `export PRIVATE_KEY=0x...` (hex) o decimal.
 *
 * `MNEMONIC` también puede ser una ruta a un fichero con las palabras (soportado por Foundry en `deriveKey`).
 * Nunca commitees mnemónicos ni claves.
 */
contract DeployHonkVerifier is Script {
    function run() external {
        uint256 pk = _resolvePrivateKey();
        console2.log("Deployer:", vm.addr(pk));
        vm.startBroadcast(pk);
        HonkVerifier v = new HonkVerifier();
        console2.log("HonkVerifier deployed at:", address(v));
        vm.stopBroadcast();
    }

    function _resolvePrivateKey() private view returns (uint256) {
        string memory phrase = vm.envOr("MNEMONIC", string(""));
        if (bytes(phrase).length > 0) {
            uint32 idx = uint32(vm.envOr("ACCOUNT_INDEX", uint256(0)));
            string memory customPath = vm.envOr("ACCOUNT_DERIVATION_PATH", string(""));
            if (bytes(customPath).length == 0) {
                return vm.deriveKey(phrase, idx);
            }
            return vm.deriveKey(phrase, customPath, idx);
        }
        return vm.parseUint(vm.envString("PRIVATE_KEY"));
    }
}
