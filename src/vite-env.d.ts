/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Activa el Service Worker de la PWA en desarrollo (por defecto desactivado). */
  readonly VITE_PWA_DEV?: string
  /** Origen real del dev server, p. ej. `http://127.0.0.1:5173`, si abrís la app por un proxy en otro puerto. */
  readonly VITE_DEV_SERVER_ORIGIN?: string
  /** Puerto que ve el navegador para WebSocket HMR (p. ej. el del proxy IDE). */
  readonly VITE_DEV_HMR_CLIENT_PORT?: string
  /** URL del relay Yohualli (wss://… en producción). Opcional en Atestaciones. */
  readonly VITE_YOHUALLI_RELAY_WS?: string
  /**
   * URL wss pública p. ej. `wss://….up.railway.app` — aparece un preset “Railway” junto
   * a “Proxy /__yohualli_relay” y “Directo :8080” en Atestaciones.
   */
  readonly VITE_YOHUALLI_RELAY_RAILWAY?: string
  /** Trusted seeds de lab (SS58 coma-separados) para Tier-SybilRank; ver `trustedSeedsLab.ts`. */
  readonly VITE_LAB_TRUSTED_SS58?: string
  /** Trusted seeds EVM `0x` coma-separados si hay nodos en ese formato en el subgrafo. */
  readonly VITE_LAB_TRUSTED_EVM?: string
  /** Contrato HonkVerifier desplegado en la EVM de Polkadot Hub testnet */
  readonly VITE_PASEO_VERIFIER_ADDRESS?: string
  /** YohualliMerkleHonkRegistry: `verify` / `verifyForEpoch` (opcional en ZK Lab) */
  readonly VITE_PASEO_MERKLE_REGISTRY_ADDRESS?: string
  /** Opcional: clave de lab para prover en cliente (mismo default anvil que el script `gen-yohualli-merkle-attest-v1-prover.mjs`). */
  readonly VITE_YOHUALLI_CIRCUIT_LAB_PK?: string
  /** Opcional: `merkle_root` de lab (32 B) para prover; default = subjectCommitment v0 (trusted seed, 1 hoja). */
  readonly VITE_YOHUALLI_LAB_MERKLE_ROOT?: string
  /** Opcional: SS58 de sujeto de lab para circuito `yohualli_subject_commitment_v0` (pk 32 B). */
  readonly VITE_YOHUALLI_LAB_SUBJECT_SS58?: string
  /** Por defecto `https://eth-rpc-testnet.polkadot.io` */
  readonly VITE_PASEO_RPC_URL?: string
  /** Por defecto `420420417` (Polkadot Hub Testnet en MetaMask) */
  readonly VITE_PASEO_CHAIN_ID?: string
  /** Por defecto `https://blockscout.testnet.polkadot.io` */
  readonly VITE_PASEO_EXPLORER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
