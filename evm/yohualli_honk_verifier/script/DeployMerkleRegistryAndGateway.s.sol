// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {MerkleRootRegistry} from "../src/MerkleRootRegistry.sol";
import {YohualliHonkGateway} from "../src/YohualliHonkGateway.sol";

/**
 * @dev **Obsoleto en testnet Polkadot Hub:** el script con dos `CREATE` a veces falla con `status: 0`.
 *      Usar `DeployYohualliMerkleHonkRegistry.s.sol` (un solo contrato).
 * Despliega `MerkleRootRegistry` y `YohualliHonkGateway` (tests locales / otras cadenas).
 * Requiere `HONK_VERIFIER_ADDRESS=0x...`.
 */
contract DeployMerkleRegistryAndGateway is Script {
    function run() public returns (MerkleRootRegistry reg, YohualliHonkGateway gateway) {
        address honk = vm.envAddress("HONK_VERIFIER_ADDRESS");

        uint256 deployerPrivateKey = _resolvePrivateKey();
        console2.log("Deployer:", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        reg = new MerkleRootRegistry();
        console2.log("MerkleRootRegistry:", address(reg));
        gateway = new YohualliHonkGateway(honk, address(reg));
        console2.log("YohualliHonkGateway:", address(gateway));

        vm.stopBroadcast();
    }

    /// Misma lógica que `DeployHonkVerifier.s.sol` (MNEMONIC opcional, `ACCOUNT_DERIVATION_PATH` opcional).
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
