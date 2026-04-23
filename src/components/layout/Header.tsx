import { Button } from '@/components/ui/button'
import { Search, Bell, LogOut } from 'lucide-react'
import { NetworkSwitcher } from '@/components/NetworkSwitcher'
import { AccountSwitcher } from '@/components/layout/AccountSwitcher'
import { useContext } from 'react'
import { NetworkContext } from '@/contexts/NetworkContext'
import { KeyringContext } from '@/contexts/KeyringContext'

// Componente separado para el botón de logout
// Usa useContext directamente para evitar el error si el contexto no está disponible
function LogoutButton() {
  const keyringContext = useContext(KeyringContext)
  
  // Si el contexto no está disponible, no mostrar el botón
  if (!keyringContext) {
    return null
  }
  
  const { isUnlocked, lock } = keyringContext
  
  if (!isUnlocked || !lock) {
    return null
  }
  
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-8 w-8 sm:h-10 sm:w-10"
      onClick={lock}
      title="Cerrar sesión"
    >
      <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
    </Button>
  )
}

export function Header() {
  // Usar useContext directamente para evitar el error si el contexto no está disponible
  const context = useContext(NetworkContext)
  
  // Si el contexto no está disponible, renderizar un header simplificado
  if (!context) {
    return (
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 safe-area-inset-top">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 max-w-full overflow-hidden">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold truncate">Yohualli Protocol</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <LogoutButton />
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                <Search className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>
    )
  }
  
  const { selectedChain, setSelectedChain, isConnecting } = context

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 safe-area-inset-top">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 max-w-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold shrink-0">Yohualli Protocol</h1>
            <div className="min-w-0 max-w-[14rem] flex-1 sm:max-w-md">
              <AccountSwitcher />
            </div>
            <div className="hidden sm:block flex-shrink-0">
              <NetworkSwitcher
                selectedChain={selectedChain}
                onSelectChain={setSelectedChain}
                isConnecting={isConnecting}
              />
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <LogoutButton />
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="sm:hidden">
              <NetworkSwitcher
                selectedChain={selectedChain}
                onSelectChain={setSelectedChain}
                isConnecting={isConnecting}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
