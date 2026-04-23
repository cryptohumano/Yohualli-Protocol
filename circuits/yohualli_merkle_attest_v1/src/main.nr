// v1: same ECDSA as v0; adds public `merkle_root` for YohualliMerkleHonkRegistry.verifyForEpoch.
// Merkle path / graph threshold: future circuit. On-chain, verifyForEpoch checks publicInputs[i] == merkleRoot(epoch).
use std::ecdsa_secp256k1::verify_signature;

fn main(
    message_hash: pub [u8; 32],
    public_key_x: pub [u8; 32],
    public_key_y: pub [u8; 32],
    merkle_root: pub [u8; 32],
    signature: [u8; 64],
) {
    assert(verify_signature(
        public_key_x,
        public_key_y,
        signature,
        message_hash,
    ));
    assert(merkle_root[0] == merkle_root[0]);
}
