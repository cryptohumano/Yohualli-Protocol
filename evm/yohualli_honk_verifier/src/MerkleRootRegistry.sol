// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

/**
 * @title Registro mínimo de `merkleRoot` por epoch (Yohualli).
 * @dev El rol de *trusted seed* o agregador se modela ahora con `owner`; luego: multisig,
 *   `onlyRole`, o set de semillas. Ver `docs/YOHUALLI_MERKLE_PROOF_V0.md`.
 */
contract MerkleRootRegistry {
    address public owner;
    /// @dev Raíz del Merkle de sujetos (hojas = `subjectCommitment` deduplicados) publicada para esa epoch lógica.
    mapping(uint256 epoch => bytes32) public merkleRoot;

    event MerkleRootUpdated(uint256 indexed epoch, bytes32 indexed root, address indexed updater);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroAddress();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setMerkleRoot(uint256 epoch, bytes32 root) external onlyOwner {
        merkleRoot[epoch] = root;
        emit MerkleRootUpdated(epoch, root, msg.sender);
    }
}
