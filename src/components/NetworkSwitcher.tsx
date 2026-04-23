import { NETWORK_OPTIONS, type ChainInfo } from '@/hooks/useDedotClient'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NetworkSwitcherProps {
  selectedChain: ChainInfo | null
  onSelectChain: (chain: ChainInfo) => void
  isConnecting: boolean
  /** p. ej. ancho completo en cabecera móvil apilada */
  className?: string
  triggerClassName?: string
}

export function NetworkSwitcher({
  selectedChain,
  onSelectChain,
  isConnecting,
  className,
  triggerClassName,
}: NetworkSwitcherProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-1.5 sm:gap-2', className)}>
      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : selectedChain ? (
        <Wifi className="h-4 w-4 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-muted-foreground" />
      )}
      <Select
        value={selectedChain?.endpoint || ''}
        onValueChange={(endpoint) => {
          const chain = NETWORK_OPTIONS.find((c) => c.endpoint === endpoint)
          if (chain) {
            onSelectChain(chain)
          }
        }}
        disabled={isConnecting}
      >
        <SelectTrigger
          className={cn(
            'h-8 min-w-0 w-full max-w-full sm:h-9 sm:w-[min(100vw-8rem,280px)] sm:max-w-[280px] text-left text-xs sm:text-sm',
            triggerClassName
          )}
        >
          <SelectValue placeholder="Seleccionar red">
            {selectedChain ? selectedChain.name : 'Seleccionar red'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {NETWORK_OPTIONS.map((chain) => (
            <SelectItem key={chain.endpoint} value={chain.endpoint} className="py-2">
              <div className="flex flex-col gap-1 text-left max-w-[min(85vw,320px)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium leading-tight">{chain.name}</span>
                  {selectedChain?.endpoint === chain.endpoint && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Activa
                    </Badge>
                  )}
                </div>
                {chain.evm ? (
                  <span className="text-[10px] text-muted-foreground font-mono leading-snug break-all">
                    chain ID {chain.evm.chainId} · {chain.evm.rpcHttp}
                  </span>
                ) : (
                  chain.description && (
                    <span className="text-[10px] text-muted-foreground line-clamp-2">
                      {chain.description}
                    </span>
                  )
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

