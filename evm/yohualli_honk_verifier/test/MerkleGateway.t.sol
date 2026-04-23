// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {MerkleRootRegistry} from "../src/MerkleRootRegistry.sol";
import {YohualliHonkGateway} from "../src/YohualliHonkGateway.sol";
import {YohualliMerkleHonkRegistry} from "../src/YohualliMerkleHonkRegistry.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";

contract MockHonkAlwaysTrue {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return true;
    }
}

contract MerkleGatewayTest is Test {
    function test_Registry_SetsAndEmits() public {
        MerkleRootRegistry r = new MerkleRootRegistry();
        vm.expectEmit(true, true, true, true);
        emit MerkleRootRegistry.MerkleRootUpdated(7, bytes32(uint256(1234)), address(this));
        r.setMerkleRoot(7, bytes32(uint256(1234)));
        assertEq(r.merkleRoot(7), bytes32(uint256(1234)));
    }

    function test_Gateway_VerifyForEpoch_RevertsMerkleMismatch() public {
        HonkVerifier h = new HonkVerifier();
        MerkleRootRegistry r = new MerkleRootRegistry();
        YohualliHonkGateway g = new YohualliHonkGateway(address(h), address(r));

        r.setMerkleRoot(1, bytes32(uint256(111)));
        // Merkle "querido" no coincide con el de los 32 Fr (222…)
        bytes32[] memory pubs = _frMerkle32(bytes32(uint256(222)));
        vm.expectRevert(YohualliHonkGateway.MerkleRootMismatch.selector);
        g.verifyForEpoch(1, hex"", pubs, 0);
    }

    function test_CombinedRegistry_VerifyForEpoch_RevertsMerkleMismatch() public {
        HonkVerifier h = new HonkVerifier();
        YohualliMerkleHonkRegistry c = new YohualliMerkleHonkRegistry();
        c.setHonkVerifier(address(h));
        c.setMerkleRoot(1, bytes32(uint256(111)));
        bytes32[] memory pubs = _frMerkle32(bytes32(uint256(222)));
        vm.expectRevert(YohualliMerkleHonkRegistry.MerkleRootMismatch.selector);
        c.verifyForEpoch(1, hex"", pubs, 0);
    }

    function test_CombinedRegistry_ReplaceHonkVerifier() public {
        HonkVerifier h1 = new HonkVerifier();
        HonkVerifier h2 = new HonkVerifier();
        YohualliMerkleHonkRegistry c = new YohualliMerkleHonkRegistry();
        c.setHonkVerifier(address(h1));
        assertEq(address(c.honk()), address(h1));
        c.replaceHonkVerifier(address(h2));
        assertEq(address(c.honk()), address(h2));
    }

    /// subjectCommitment v0 (1 hoja = root) alineado a PWA: `0x18d4…` para trusted seed 5FnBJL…
    function test_CombinedRegistry_VerifyForEpoch_PackMatchesTrustedSeedLeaf() public {
        YohualliMerkleHonkRegistry c = new YohualliMerkleHonkRegistry();
        c.setHonkVerifier(address(new MockHonkAlwaysTrue()));
        bytes32 root = 0x18d4ecafedefe6837fa7991b719751ec387108db025bf3f0046ff7f6b23a468c;
        c.setMerkleRoot(0, root);
        bytes32[] memory merkle32 = _frMerkle32(root);
        bytes32[] memory pubs = new bytes32[](128);
        for (uint256 i = 0; i < 128; i++) {
            if (i < 96) {
                pubs[i] = bytes32(0);
            } else {
                pubs[i] = merkle32[i - 96];
            }
        }
        assertTrue(c.verifyForEpoch(0, hex"00", pubs, 96));
    }

    function _frMerkle32(bytes32 root) internal pure returns (bytes32[] memory p) {
        p = new bytes32[](32);
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(uint256(uint256(root) >> (8 * (31 - i))));
            p[i] = bytes32(uint256(b));
        }
    }
}
