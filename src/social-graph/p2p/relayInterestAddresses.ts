import { decodeAddress, encodeAddress } from '@polkadot/util-crypto'

/** Prefijos SS58 habituales en lab; el relay compara strings literales. */
const SS58_PREFIXES = [42, 0, 2, 5] as const

export type GossipWatchAccount = {
  address: string
  dualSubstrateSs58?: {
    sr25519?: string
    ed25519?: string
    ecdsa?: string
  }
}

/** Variantes SS58 del mismo pubkey para el filtro `yohualli/watch` del relay. */
export function expandSs58ForRelayWatch(addr: string): string[] {
  const t = addr.trim()
  if (!t) return []
  try {
    const raw = decodeAddress(t)
    const out = new Set<string>([t])
    for (const prefix of SS58_PREFIXES) {
      try {
        out.add(encodeAddress(raw, prefix))
      } catch {
        /* ignore */
      }
    }
    return [...out]
  } catch {
    return [t]
  }
}

const RELAY_MAX_WATCH = 64

/**
 * Lista ordenada para `yohualli/watch` (máx. 64): cuentas primero, variantes SS58, QR y campo sujeto.
 * Sin esto, un atestado con sujeto en prefijo 0 y la PWA del sujeto mostrando prefijo 42 no recibe sync ni fan-out.
 */
export function buildYohualliWatchSubjectList(
  accounts: readonly GossipWatchAccount[],
  opts: { subjectField?: string; qrRequestField?: string }
): string[] {
  const max = RELAY_MAX_WATCH
  const seen = new Set<string>()
  const out: string[] = []

  const pushExpanded = (s: string | undefined) => {
    if (!s?.trim()) return
    for (const x of expandSs58ForRelayWatch(s)) {
      if (seen.has(x)) continue
      seen.add(x)
      out.push(x)
      if (out.length >= max) return
    }
  }

  for (const a of accounts) {
    pushExpanded(a.address)
    if (out.length >= max) return out
  }
  for (const a of accounts) {
    const d = a.dualSubstrateSs58
    if (d) {
      pushExpanded(d.sr25519)
      if (out.length >= max) return out
      pushExpanded(d.ed25519)
      if (out.length >= max) return out
      pushExpanded(d.ecdsa)
      if (out.length >= max) return out
    }
  }
  pushExpanded(opts.qrRequestField)
  if (out.length >= max) return out
  pushExpanded(opts.subjectField)
  return out
}
