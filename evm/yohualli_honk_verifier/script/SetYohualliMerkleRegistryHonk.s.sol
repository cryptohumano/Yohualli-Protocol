// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {YohualliMerkleHonkRegistry} from "../src/YohualliMerkleHonkRegistry.sol";

/**
 * Segundo paso: `setHonkVerifier` en un `YohualliMerkleHonkRegistry` ya desplegado.
 * Solo ejecutar si `cast code $YOHUALLI_MERKLE_REGISTRY` devuelve bytecode (el `CREATE` tuvo éxito).
 */
contract SetYohualliMerkleRegistryHonk is Script {
    function run() public {
        string memory merkleStr = vm.envOr("YOHUALLI_MERKLE_REGISTRY", string(""));
        require(
            bytes(merkleStr).length > 0,
            "YOHUALLI_MERKLE_REGISTRY: exporta la direccion del registry (42 chars 0x...), p. ej. el despliegue de evm:forge:merkle"
        );
        string memory honkStr = vm.envOr("HONK_VERIFIER_ADDRESS", string(""));
        require(
            bytes(honkStr).length > 0,
            "HONK_VERIFIER_ADDRESS: exporta la direccion del contrato HonkVerifier (42 chars 0x...). Despliega primero: npm run evm:forge:honk"
        );
        address merkle = vm.parseAddress(merkleStr);
        address honk = vm.parseAddress(honkStr);
        require(merkle.code.length > 0, "no bytecode at YOHUALLI_MERKLE_REGISTRY (cast code); do not setHonk on failed deploy/EOA");

        uint256 deployerPrivateKey = _resolvePrivateKey();
        require(vm.addr(deployerPrivateKey) == YohualliMerkleHonkRegistry(merkle).owner(), "must be registry owner");

        vm.startBroadcast(deployerPrivateKey);
        YohualliMerkleHonkRegistry(merkle).setHonkVerifier(honk);
        console2.log("setHonkVerifier on", merkle, "->", honk);
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
