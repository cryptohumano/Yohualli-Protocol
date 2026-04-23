// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {MerkleRootRegistry} from "./MerkleRootRegistry.sol";

interface IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/**
 * @title Enlace on-chain: registro de raíces + `HonkVerifier` Barretenberg.
 * @dev `verify` reenvía al verificador del circuito actual. `verifyForEpoch` añade la
 *   condición `publicInputs[merkleRootPublicIndex] == merkleRoot(epoch)` cuando el circuito
 *   publica un `merkle_root` (circuito v0 = solo ECDSA, sin Merkle: usar solo `verify`).
 *   El Merkle *path* nunca vive on-chain: va en el witness; la prueba atestigua inclusión.
 */
contract YohualliHonkGateway {
    IHonkVerifier public immutable honk;
    MerkleRootRegistry public immutable merkleRootRegistry;

    error MerkleRootMismatch();
    error PublicInputIndexOutOfBounds();
    error ZeroAddress();

    constructor(address honkVerifier, address merkleRootRegistry_) {
        if (honkVerifier == address(0) || merkleRootRegistry_ == address(0)) revert ZeroAddress();
        honk = IHonkVerifier(honkVerifier);
        merkleRootRegistry = MerkleRootRegistry(merkleRootRegistry_);
    }

    /// Misma firma que `HonkVerifier.verify` (circuito y públicos vigentes).
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        return honk.verify(proof, publicInputs);
    }

    /// @param merkleFieldStart Primer índice del bloque de 32 Fr con el `merkle_root` (ver `YohualliMerkleHonkRegistry`).
    function verifyForEpoch(
        uint256 epoch,
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        uint256 merkleFieldStart
    ) external view returns (bool) {
        if (merkleFieldStart + 32 > publicInputs.length) revert PublicInputIndexOutOfBounds();
        if (_merkleFrBytes32(publicInputs, merkleFieldStart) != merkleRootRegistry.merkleRoot(epoch)) {
            revert MerkleRootMismatch();
        }
        return honk.verify(proof, publicInputs);
    }

    function _merkleFrBytes32(bytes32[] calldata p, uint256 start) private pure returns (bytes32) {
        uint256 out;
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(uint256(p[start + i]));
            out = (out << 8) | uint256(b);
        }
        return bytes32(out);
    }
}
