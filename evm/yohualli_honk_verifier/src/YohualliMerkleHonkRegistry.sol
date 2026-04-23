// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

/**
 * @title Un solo contrato: `merkleRoot` por epoch + reenvío a `HonkVerifier` (Yohualli, Polkadot Hub EVM / Revive).
 * @dev En Polkadot Hub/Revive, el `CREATE` a veces falla on-chain aunque `cast run` replique con éxito. Despliegue en dos scripts: solo
 *     `CREATE` (`DeployYohualliMerkleHonkRegistry`) y, si `cast code` no es vacío, `setHonkVerifier` (`SetYohualliMerkleRegistryHonk`).
 *     `MerkleRootRegistry` + `YohualliHonkGateway` siguen para pruebas Foundry.
 */
interface IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

contract YohualliMerkleHonkRegistry {
    address public owner;
    mapping(uint256 epoch => bytes32) public merkleRoot;
    // `honk` in storage (not immutable): Revive/Hub can reject init-code that uses immutables while revm `cast run` succeeds.
    IHonkVerifier public honk;

    event MerkleRootUpdated(uint256 indexed epoch, bytes32 indexed root, address indexed updater);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    error MerkleRootMismatch();
    error PublicInputIndexOutOfBounds();
    error ZeroAddress();
    error Unauthorized();
    error HonkNotSet();
    error HonkAlreadySet();

    constructor() {
        owner = msg.sender;
    }

    /// @notice Enlaza el `HonkVerifier` una sola vez (despliegue 2.ª tx en testnets que fallan el `CREATE` con arg).
    function setHonkVerifier(address honkVerifier) external onlyOwner {
        if (address(honk) != address(0)) revert HonkAlreadySet();
        if (honkVerifier == address(0)) revert ZeroAddress();
        honk = IHonkVerifier(honkVerifier);
    }

    /// @notice Sustituye el verificador (mismo `owner`); para actualizar la VK p. ej. a `yohualli_merkle_attest_v1` sin desplegar otro registry.
    function replaceHonkVerifier(address honkVerifier) external onlyOwner {
        if (honkVerifier == address(0)) revert ZeroAddress();
        honk = IHonkVerifier(honkVerifier);
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

    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool) {
        if (address(honk) == address(0)) revert HonkNotSet();
        return honk.verify(proof, publicInputs);
    }

    /**
     * @notice Comprueba `Honk.verify` y que el root on-chain coincida con el `merkle_root` del circuito.
     * @param merkleFieldStart Índice 0-based del **primer** Fr del bloque de 32 públicos en que Barretenberg
     *   descompone `merkle_root: [u8; 32]` (un `bytes32` por fila, byte en los 8 bits bajos). Para
     *   `yohualli_merkle_attest_v1` suele ser `96` (tras `message_hash` y la clave pública). El root almacenado
     *   vía `setMerkleRoot` debe ser el `bytes32` cuyo byte `i` (big-endian) coincide con `uint8(uint256(publicInputs[merkleFieldStart + i]))`.
     */
    function verifyForEpoch(
        uint256 epoch,
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        uint256 merkleFieldStart
    ) external view returns (bool) {
        if (address(honk) == address(0)) revert HonkNotSet();
        if (merkleFieldStart + 32 > publicInputs.length) revert PublicInputIndexOutOfBounds();
        if (_merkleFrBytes32(publicInputs, merkleFieldStart) != merkleRoot[epoch]) revert MerkleRootMismatch();
        return honk.verify(proof, publicInputs);
    }

    /// @dev Empaqueta 32 entradas Fr (byte en 8b bajos) en un `bytes32` (b0 = MSB).
    function _merkleFrBytes32(bytes32[] calldata p, uint256 start) internal pure returns (bytes32) {
        uint256 out;
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(uint256(p[start + i]));
            out = (out << 8) | uint256(b);
        }
        return bytes32(out);
    }
}
