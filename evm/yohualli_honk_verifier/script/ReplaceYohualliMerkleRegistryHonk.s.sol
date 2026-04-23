// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {YohualliMerkleHonkRegistry} from "../src/YohualliMerkleHonkRegistry.sol";

/**
 * Sustituye el `HonkVerifier` vía `replaceHonkVerifier` (mismo `owner` que el registry desplegado con este repo).
 * El registry antiguo en Paseo que solo tenía `setHonkVerifier` (una sola vez) no incluye este método: hay que desplegar un
 * YohualliMerkleHonkRegistry nuevo (`npm run evm:forge:merkle`) y luego set-honk / set-root.
 */
contract ReplaceYohualliMerkleRegistryHonk is Script {
    function run() public {
        string memory merkleStr = vm.envOr("YOHUALLI_MERKLE_REGISTRY", string(""));
        require(
            bytes(merkleStr).length > 0,
            "YOHUALLI_MERKLE_REGISTRY: 0x del YohualliMerkleHonkRegistry (bytecode con replaceHonkVerifier)"
        );
        string memory honkStr = vm.envOr("HONK_VERIFIER_ADDRESS", string(""));
        require(bytes(honkStr).length > 0, "HONK_VERIFIER_ADDRESS: nuevo Honk (0x, 42 chars).");

        address merkle = vm.parseAddress(merkleStr);
        address newHonk = vm.parseAddress(honkStr);
        require(merkle.code.length > 0, "no bytecode at YOHUALLI_MERKLE_REGISTRY");
        require(newHonk.code.length > 0, "no bytecode at HONK_VERIFIER_ADDRESS");

        uint256 deployerPrivateKey = _resolvePrivateKey();
        require(
            vm.addr(deployerPrivateKey) == YohualliMerkleHonkRegistry(merkle).owner(), "must be registry owner"
        );

        vm.startBroadcast(deployerPrivateKey);
        YohualliMerkleHonkRegistry(merkle).replaceHonkVerifier(newHonk);
        console2.log("replaceHonkVerifier on", merkle, "->", newHonk);
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
