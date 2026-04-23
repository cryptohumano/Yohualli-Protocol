import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DualSubstrateSs58 } from '@/utils/substrateDualSs58'

type Props = {
  dual: DualSubstrateSs58
  /** 0x cuenta 0 (BIP44), misma convención que MetaMask. */
  evmAddress?: string | null
  className?: string
  /** Texto breve sobre SS58 vs EVM. */
  showDerivationHint?: boolean
}

const SS58_ORDER: Array<{ key: keyof DualSubstrateSs58; label: string }> = [
  { key: 'sr25519', label: 'sr25519' },
  { key: 'ed25519', label: 'ed25519' },
  { key: 'ecdsa', label: 'ecdsa' },
]

/**
 * Tres líneas SS58 y opcionalmente la 0x EVM, mismo estilo visual entre sí.
 */
export function DualSubstrateAddressLines({
  dual,
  evmAddress,
  className,
  showDerivationHint = true,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = async (addr: string) => {
    await navigator.clipboard.writeText(addr)
    setCopied(addr)
    setTimeout(() => setCopied(null), 2000)
  }

  const evm = evmAddress?.trim() || null

  return (
    <div className={cn('space-y-2', className)}>
      {showDerivationHint ? (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Misma frase o URI: vistas SS58 (sr25519, ed25519, ecdsa){evm ? ' y dirección EVM (BIP44, no keccak sobre pubkey Substrate)' : ''}.
        </p>
      ) : null}
      {SS58_ORDER.map(({ key, label }) => {
        const addr = dual[key]
        return (
          <div key={key} className="flex flex-wrap items-center gap-2 min-w-0">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide shrink-0">
              {label}
            </Badge>
            <code className="text-xs font-mono text-muted-foreground break-all flex-1 min-w-0">{addr}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0"
              onClick={() => void handleCopy(addr)}
              title="Copiar dirección"
            >
              {copied === addr ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )
      })}
      {evm ? (
        <div className="flex flex-wrap items-center gap-2 min-w-0 pt-1 border-t border-border/60">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide shrink-0">
            evm
          </Badge>
          <code className="text-xs font-mono text-muted-foreground break-all flex-1 min-w-0">{evm}</code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            onClick={() => void handleCopy(evm)}
            title="Copiar dirección"
          >
            {copied === evm ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            onClick={() => window.open(`https://etherscan.io/address/${evm}`, '_blank')}
            title="Ver en Etherscan"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
