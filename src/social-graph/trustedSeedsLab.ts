import { decodeAddress, encodeAddress } from '@polkadot/util-crypto'

/**
 * Trusted seeds **solo para lab** (off-chain) + fusión futura con contrato.
 * Cada **identidad** puede tener SS58 y/o EVM (misma cuenta / mismo keyring BIP44).
 *
 * - Lista: `LAB_TRUSTED_SEED_IDENTITIES` y/o `VITE_LAB_TRUSTED_SS58` + `VITE_LAB_TRUSTED_EVM` (mismo índice = par).
 * - Verificación PWA: `verifyTrustedSeedLabAccount` (compara cuenta desbloqueada vs identidades).
 * - Grafo: aristas siguen siendo Substrate; si en el futuro hay nodos `0x…`, también matchean.
 * - SybilRank: `resolveTrustedSeedRepresentativesForSybil` da **una** dirección por identidad presente
 *   en el subgrafo (evita doble masa si SS58 y EVM aparecen como dos nodos).
 */

/**
 * EVM bajo el path de atestación Yohualli (`YOHUALLI_ATTESTATION_BIP44_PATH` en
 * `yohualliAttestationEip712.ts`); misma mnemónica que `evm: 0x99B6…` arriba, **distinta** a cuenta 0.
 * No es una fila extra de “trusted” en Sybil: allí pesa el par SS58 + EVM 0' del array.
 * Ver `docs/YOHUALLI_EVM_CONTRACTS_ARCHITECTURE.md` §2.1.
 */
export const LAB_YOHUALLI_EVM_ATTEST_10: `0x${string}` =
  '0xA4a6B032591CF6805808d838a5ab1a44463Ea16' as const

/** Una cara trusted por identidad (misma posición en SS58 y EVM = mismo par de lab). */
export const LAB_TRUSTED_SEED_IDENTITIES: readonly { substrate?: string; evm?: string }[] = [
  {
    substrate: '5FnBJLXEjEYiGeTgKaxapS2m8WpsTUGp1sj2ZbwMhodQUo9t',
    /* m/44'/60'/0'/0/0 — no confundir con `LAB_YOHUALLI_EVM_ATTEST_10`. */
    evm: '0x99B65AE259Fc06fF4A90cE898eaA1BD2aaF32eb8',
  },
]

export type TrustedSeedIdentityLab = {
  substrateCanonical: string | null
  evm0xLower: string | null
}

export type TrustedSeedsLabConfig = {
  substrateCanonical: readonly string[]
  evm0xLower: readonly string[]
}

export type TrustedLabAccountVerification =
  | {
      status: 'full'
      message: string
      identityIndex: number
      substrateMatches: true
      evmMatches: true
    }
  | {
      status: 'substrate_only'
      message: string
      identityIndex: number
      substrateMatches: true
      evmMatches: boolean
    }
  | {
      status: 'evm_only'
      message: string
      identityIndex: number
      substrateMatches: boolean
      evmMatches: true
    }
  | {
      status: 'mismatch'
      message: string
      identityIndex: number | null
      substrateMatches: boolean
      evmMatches: boolean
    }
  | {
      status: 'no_config'
      message: string
      identityIndex: null
      substrateMatches: false
      evmMatches: false
    }

function parseCommaList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function tryCanonicalSs58(addr: string): string | null {
  try {
    return encodeAddress(decodeAddress(addr.trim()))
  } catch {
    return null
  }
}

export function normalizeTrustedLabEvm(addr: string): string | null {
  const t = addr.trim()
  if (!t) return null
  const lower = t.startsWith('0x') ? t.toLowerCase() : `0x${t.toLowerCase()}`
  if (!/^0x[a-f0-9]{40}$/.test(lower)) return null
  return lower
}

function normalizeIdentityRow(row: { substrate?: string; evm?: string }): TrustedSeedIdentityLab {
  return {
    substrateCanonical: row.substrate ? tryCanonicalSs58(row.substrate) : null,
    evm0xLower: row.evm ? normalizeTrustedLabEvm(row.evm) : null,
  }
}

/** Identidades desde constantes + pares por índice desde env (misma posición en ambas listas). */
export function getLabTrustedSeedIdentities(): TrustedSeedIdentityLab[] {
  const out: TrustedSeedIdentityLab[] = []
  for (const row of LAB_TRUSTED_SEED_IDENTITIES) {
    const n = normalizeIdentityRow(row)
    if (n.substrateCanonical || n.evm0xLower) out.push(n)
  }
  const ss = parseCommaList(import.meta.env.VITE_LAB_TRUSTED_SS58)
    .map((a) => tryCanonicalSs58(a))
    .filter((x): x is string => Boolean(x))
  const ev = parseCommaList(import.meta.env.VITE_LAB_TRUSTED_EVM)
    .map((a) => normalizeTrustedLabEvm(a))
    .filter((x): x is string => Boolean(x))
  const nExtra = Math.max(ss.length, ev.length)
  for (let i = 0; i < nExtra; i++) {
    const n: TrustedSeedIdentityLab = {
      substrateCanonical: ss[i] ?? null,
      evm0xLower: ev[i] ?? null,
    }
    if (n.substrateCanonical || n.evm0xLower) out.push(n)
  }
  return out
}

/** Aplana identidades para matcheo rápido en el grafo (`isTrustedSeedAddress`). */
export function trustedIdentitiesToFlatConfig(identities: readonly TrustedSeedIdentityLab[]): TrustedSeedsLabConfig {
  const ss = new Set<string>()
  const ev = new Set<string>()
  for (const id of identities) {
    if (id.substrateCanonical) ss.add(id.substrateCanonical)
    if (id.evm0xLower) ev.add(id.evm0xLower)
  }
  return { substrateCanonical: [...ss], evm0xLower: [...ev] }
}

export function getLabTrustedSeeds(): TrustedSeedsLabConfig {
  return trustedIdentitiesToFlatConfig(getLabTrustedSeedIdentities())
}

/**
 * Futuro: direcciones registradas en contrato / registry. Hoy devuelve `[]`.
 * Cuando exista, fusionar con `getLabTrustedSeedIdentities()` vía `getMergedTrustedSeedIdentities`.
 */
export async function fetchTrustedSeedIdentitiesFromContract(): Promise<TrustedSeedIdentityLab[]> {
  return []
}

export async function getMergedTrustedSeedIdentities(): Promise<TrustedSeedIdentityLab[]> {
  const [lab, onchain] = await Promise.all([
    Promise.resolve(getLabTrustedSeedIdentities()),
    fetchTrustedSeedIdentitiesFromContract(),
  ])
  return [...lab, ...onchain]
}

/** Compara la cuenta del keyring con las identidades trusted de lab (+ futuro on-chain). */
export function verifyTrustedSeedLabAccount(
  input: { substrateAddress: string; evmBip44Address?: string | null },
  identities = getLabTrustedSeedIdentities()
): TrustedLabAccountVerification {
  if (identities.length === 0) {
    return {
      status: 'no_config',
      message: 'No hay identidades trusted configuradas (lab ni contrato).',
      identityIndex: null,
      substrateMatches: false,
      evmMatches: false,
    }
  }
  const subCanon = tryCanonicalSs58(input.substrateAddress)
  const evmAcc = input.evmBip44Address ? normalizeTrustedLabEvm(input.evmBip44Address) : null

  for (let i = 0; i < identities.length; i++) {
    const I = identities[i]
    const subM = Boolean(I.substrateCanonical && subCanon && subCanon === I.substrateCanonical)
    const evmM = Boolean(I.evm0xLower && evmAcc && evmAcc === I.evm0xLower)

    if (I.substrateCanonical && I.evm0xLower) {
      if (subM && evmM) {
        return {
          status: 'full',
          message: 'Esta cuenta coincide con el trusted seed de lab (Substrate y EVM BIP44).',
          identityIndex: i,
          substrateMatches: true,
          evmMatches: true,
        }
      }
      if (subM && !evmAcc) {
        return {
          status: 'substrate_only',
          message:
            'El SS58 coincide con el trusted seed de lab; la PWA no tiene vista EVM BIP44 (misma frase que MetaMask) para cerrar el par — suele aparecer al importar con URI completa.',
          identityIndex: i,
          substrateMatches: true,
          evmMatches: false,
        }
      }
      if (subM && evmAcc && !evmM) {
        return {
          status: 'mismatch',
          message:
            'El SS58 coincide con el trusted seed de lab, pero la dirección EVM BIP44 derivada no coincide con la configurada para ese seed. Revisá la misma mnemonic/SURI.',
          identityIndex: i,
          substrateMatches: true,
          evmMatches: false,
        }
      }
      if (!subM && evmM) {
        return {
          status: 'evm_only',
          message:
            'La EVM BIP44 coincide con el trusted seed de lab; el SS58 seleccionado no es el emparejado en la lista (operación sólo-EVM o cuenta distinta).',
          identityIndex: i,
          substrateMatches: false,
          evmMatches: true,
        }
      }
    } else if (I.substrateCanonical && subM) {
      return {
        status: 'substrate_only',
        message: 'Coincidencia Substrate con trusted seed (identidad sólo SS58 en la lista o sin par EVM).',
        identityIndex: i,
        substrateMatches: true,
        evmMatches: evmM,
      }
    } else if (I.evm0xLower && evmM) {
      return {
        status: 'evm_only',
        message: 'Coincidencia EVM con trusted seed (identidad sólo EVM en la lista).',
        identityIndex: i,
        substrateMatches: false,
        evmMatches: true,
      }
    }
  }

  return {
    status: 'mismatch',
    message: 'La cuenta seleccionada no coincide con ningún trusted seed de lab (ni Substrate ni EVM).',
    identityIndex: null,
    substrateMatches: false,
    evmMatches: false,
  }
}

/** `true` si `nodeId` (como en el grafo) coincide con alguna cara de la lista aplanada. */
export function isTrustedSeedAddress(nodeId: string, lab?: TrustedSeedsLabConfig): boolean {
  const cfg = lab ?? getLabTrustedSeeds()
  const canon = tryCanonicalSs58(nodeId)
  if (canon && cfg.substrateCanonical.includes(canon)) return true
  const ev = normalizeTrustedLabEvm(nodeId)
  if (ev && cfg.evm0xLower.includes(ev)) return true
  return false
}

/** Todos los nodos del subgrafo que matchean alguna cara trusted. */
export function resolveTrustedSeedsInNodeSet(
  nodeIds: ReadonlySet<string>,
  lab?: TrustedSeedsLabConfig
): string[] {
  const cfg = lab ?? getLabTrustedSeeds()
  const out: string[] = []
  for (const id of nodeIds) {
    if (isTrustedSeedAddress(id, cfg)) out.push(id)
  }
  return out
}

/**
 * Una dirección de grafo por identidad trusted presente (prefiere SS58 si ambas caras están en el subgrafo).
 * Evita duplicar masa de teleport en SybilRank cuando SS58 y EVM son la misma identidad.
 */
export function resolveTrustedSeedRepresentativesForSybil(
  nodeIds: ReadonlySet<string>,
  identities = getLabTrustedSeedIdentities()
): string[] {
  const reps: string[] = []
  for (const ident of identities) {
    let chosen: string | null = null
    if (ident.substrateCanonical) {
      for (const n of nodeIds) {
        const c = tryCanonicalSs58(n)
        if (c === ident.substrateCanonical) {
          chosen = n
          break
        }
      }
    }
    if (!chosen && ident.evm0xLower) {
      for (const n of nodeIds) {
        const e = normalizeTrustedLabEvm(n)
        if (e === ident.evm0xLower) {
          chosen = n
          break
        }
      }
    }
    if (chosen) reps.push(chosen)
  }
  return reps
}
