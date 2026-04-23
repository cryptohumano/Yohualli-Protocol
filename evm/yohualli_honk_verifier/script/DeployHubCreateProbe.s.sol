// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {HubCreateProbe} from "../src/HubCreateProbe.sol";

/**
 * Sube solo `HubCreateProbe` (contrato vacío) para acotar el fallo on-chain.
 * Misma clave / RPC que el despliegue de Merkle.
 */
contract DeployHubCreateProbe is Script {
    function run() public returns (HubCreateProbe p) {
        uint256 k = _resolvePrivateKey();
        console2.log("Deployer:", vm.addr(k));
        vm.startBroadcast(k);
        p = new HubCreateProbe();
        console2.log("HubCreateProbe:", address(p));
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
