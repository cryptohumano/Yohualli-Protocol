//! Subject commitment v0: keccak256(0x01 || pk), pk = 32 B Substrate public key.
//! Private: pk. Public: subject_commitment.
use keccak256::keccak256;

fn main(pk: [u8; 32], subject_commitment: pub [u8; 32]) {
    let mut data: [u8; 33] = [0; 33];
    data[0] = 1;
    for i in 0..32 {
        data[1 + i] = pk[i];
    }
    let hash: [u8; 32] = keccak256(data, 33);
    for j in 0..32 {
        assert(hash[j] == subject_commitment[j]);
    }
}
