// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {YohualliMerkleHonkRegistry} from "../src/YohualliMerkleHonkRegistry.sol";

/**
 * Fija `setMerkleRoot(epoch, root)` en un YohualliMerkleHonkRegistry (owner).
 *
 * Env: YOHUALLI_MERKLE_REGISTRY, MERKLE_EPOCH (uint256, default 0), MERKLE_ROOT (bytes32, `0x` + 64 hex)
 */
contract SetMerkleRoot is Script {
    function run() public {
        string memory regStr = vm.envOr("YOHUALLI_MERKLE_REGISTRY", string(""));
        require(bytes(regStr).length > 0, "YOHUALLI_MERKLE_REGISTRY: requerido");
        address registry = vm.parseAddress(regStr);
        require(registry.code.length > 0, "no bytecode at YOHUALLI_MERKLE_REGISTRY");

        uint256 epoch = vm.envOr("MERKLE_EPOCH", uint256(0));
        string memory rootEnv = vm.envOr("MERKLE_ROOT", string(""));
        require(bytes(rootEnv).length > 0, "MERKLE_ROOT: bytes32 hex, p. ej. lab 0x2222.. 32 B");
        bytes32 root = vm.parseBytes32(rootEnv);

        uint256 pk = _resolvePrivateKey();
        require(vm.addr(pk) == YohualliMerkleHonkRegistry(registry).owner(), "must be registry owner");

        vm.startBroadcast(pk);
        YohualliMerkleHonkRegistry(registry).setMerkleRoot(epoch, root);
        console2.log("setMerkleRoot epoch (uint):", epoch);
        console2.log("setMerkleRoot registry:", registry);
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
