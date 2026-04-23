// Minimal v0 circuit: one ECDSA secp256k1 verify on a 32-byte digest (e.g. EIP-712 final hash
// from docs/YOHUALLI_ATTESTATION_SIGNING_V0.md, signed by attestation EOA m/44'/60'/10'/0/0).
//
// Public inputs: message_hash, public_key_x, public_key_y (32 bytes each, big-endian coords).
// Private witness: signature = 64 bytes r||s (s must be low-S / BIP-62 for Noir stdlib).
use std::ecdsa_secp256k1::verify_signature;

fn main(
    message_hash: pub [u8; 32],
    public_key_x: pub [u8; 32],
    public_key_y: pub [u8; 32],
    signature: [u8; 64],
) {
    assert(verify_signature(
        public_key_x,
        public_key_y,
        signature,
        message_hash,
    ));
}
