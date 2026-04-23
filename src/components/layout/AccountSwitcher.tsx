import { useState } from 'react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { AccountSecretsDialog } from '@/components/AccountSecretsDialog'
import { ChevronDown, KeyRound } from 'lucide-react'
import Identicon from '@polkadot/react-identicon'

function shortAddr(address: string) {
  if (address.length <= 16) return address
  return `${address.slice(0, 8)}…${address.slice(-6)}`
}

/**
 * Cuenta activa (SS58) + acceso a «Claves y frase»; la elección persiste en `localStorage`.
 */
export function AccountSwitcher({
  className,
  showInlineLabel = true,
}: {
  className?: string
  showInlineLabel?: boolean
}) {
  const { accounts, activeAccountAddress, setActiveAccountAddress, isUnlocked } = useKeyringContext()
  const [secretsOpen, setSecretsOpen] = useState(false)

  if (accounts.length === 0) {
    return null
  }

  const value = activeAccountAddress ?? accounts[0]!.address
  const current = accounts.find((a) => a.address === value)
  const evmForDialog = current?.evmBip44Address ?? null

  return (
    <div
      className={cn(
        'flex min-w-0 max-w-[min(100%,16rem)] items-center gap-1.5 sm:max-w-md',
        className
      )}
    >
      {showInlineLabel && (
        <span className="hidden text-xs text-muted-foreground sm:inline shrink-0">Cuenta</span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-8 min-w-0 max-w-full justify-between border-border/80 px-2 text-left text-xs sm:h-9 sm:text-sm font-normal"
            aria-label="Cuenta activa y claves"
          >
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <Identicon value={value} size={22} theme="polkadot" className="shrink-0 rounded-full" />
              <span className="min-w-0 truncate">
                {current?.meta?.name ? `${String(current.meta.name)} · ` : ''}
                {shortAddr(value)}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56 max-w-[min(100vw-2rem,20rem)]" align="start">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Cambiar cuenta
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={setActiveAccountAddress}>
            {accounts.map((a) => (
              <DropdownMenuRadioItem
                key={a.address}
                value={a.address}
                className="text-xs sm:text-sm pl-2 gap-2"
              >
                <Identicon value={a.address} size={20} theme="polkadot" className="shrink-0 rounded-full" />
                <span className="min-w-0 truncate">
                  {a.meta?.name ? `${String(a.meta.name)} — ` : ''}
                  {shortAddr(a.address)}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs sm:text-sm cursor-pointer"
            disabled={!isUnlocked}
            onSelect={() => {
              setSecretsOpen(true)
            }}
          >
            <KeyRound className="h-4 w-4 mr-2 shrink-0" />
            Claves y frase
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountSecretsDialog
        open={secretsOpen}
        onOpenChange={setSecretsOpen}
        address={value}
        accountName={current?.meta?.name ? String(current.meta.name) : 'Sin nombre'}
        evmBip44Address={evmForDialog}
      />
    </div>
  )
}
