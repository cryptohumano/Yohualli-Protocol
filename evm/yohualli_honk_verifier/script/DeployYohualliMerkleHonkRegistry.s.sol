// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {YohualliMerkleHonkRegistry} from "../src/YohualliMerkleHonkRegistry.sol";

/**
 * Solo el `CREATE` (sin calldata) de `YohualliMerkleHonkRegistry`. En Hub, `setHonkVerifier` va en un script aparte
 * `SetYohualliMerkleRegistryHonk.s.sol` *después* de comprobar con `cast code` que el despliegue tuvo éxito.
 * (Si un `CREATE` falla, una tx siguiente a la misma address puede quedar "success" con poco `gas` sin ser contrato: llamada a EOA vacía.)
 *
 * Cuenta: `PRIVATE_KEY` o `MNEMONIC` (igual que `DeployHonkVerifier.s.sol`). Para enlazar el `HonkVerifier` — `HONK_VERIFIER_ADDRESS` + `SetYohualliMerkleRegistryHonk`.
 */
contract DeployYohualliMerkleHonkRegistry is Script {
    function run() public returns (YohualliMerkleHonkRegistry reg) {
        uint256 deployerPrivateKey = _resolvePrivateKey();
        console2.log("Deployer:", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);
        reg = new YohualliMerkleHonkRegistry();
        console2.log("YohualliMerkleHonkRegistry:", address(reg));
        console2.log("Luego: cast code (address arriba) y, si hay bytecode, YOHUALLI_MERKLE_REGISTRY=0x.. npm run evm:forge:merkle:set-honk");
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
