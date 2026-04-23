// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

/// @dev Bytecode mínimo para probar en Polkadot Hub si *cualquier* `CREATE` falla
///     (comparar con el fallo de `YohualliMerkleHonkRegistry` vía el mismo `forge script`).
contract HubCreateProbe {
    // Sin storage ni lógica: solo mide si el nodo acepta despliegues triviales.
}
