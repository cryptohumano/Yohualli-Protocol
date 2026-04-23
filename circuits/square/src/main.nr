//! Minimal learning circuit: prove knowledge of a square root.
//!
//! - Private `x`: witness (secret).
//! - Public `y`: the statement (you know sqrt(y) without revealing x).
//!
//! Constraint: x * x == y.
fn main(x: Field, y: pub Field) {
    assert(x * x == y);
}

#[test]
fn test_valid_square() {
    main(3, 9);
}
