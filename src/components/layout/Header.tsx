import { Button } from '@/components/ui/button'
import { Search, Bell, LogOut } from 'lucide-react'
import { NetworkSwitcher } from '@/components/NetworkSwitcher'
import { AccountSwitcher } from '@/components/layout/AccountSwitcher'
import { useContext } from 'react'
import { NetworkContext } from '@/contexts/NetworkContext'
import { KeyringContext } from '@/contexts/KeyringContext'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher'

// Componente separado para el botón de logout
// Usa useContext directamente para evitar el error si el contexto no está disponible
function LogoutButton() {
  const { t } = useTranslation('common')
  const keyringContext = useContext(KeyringContext)

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
      title={t('header.logout')}
    >
      <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
    </Button>
  )
}

/** Iconos búsqueda y campana (misma accesibilidad en móvil y sm+) */
function HeaderIconActions() {
  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" aria-label="Búsqueda" type="button">
        <Search className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" aria-label="Notificaciones" type="button">
        <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>
    </>
  )
}

export function Header() {
  const { t } = useTranslation('common')
  const context = useContext(NetworkContext)

  if (!context) {
    return (
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 safe-area-inset-top">
        <div className="container mx-auto max-w-full overflow-hidden px-2 py-2 sm:px-4 sm:py-3">
          <div className="sm:hidden">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h1 className="min-w-0 flex-1 truncate text-base font-bold leading-tight">{t('app.name')}</h1>
              <div className="flex shrink-0 items-center gap-0.5">
                <LanguageSwitcher compact />
                <LogoutButton />
                <HeaderIconActions />
              </div>
            </div>
          </div>
          <div className="hidden sm:flex sm:min-w-0 sm:items-center sm:justify-between sm:gap-3">
            <h1 className="text-lg font-bold md:text-xl">{t('app.name')}</h1>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <LanguageSwitcher />
              <LogoutButton />
              <HeaderIconActions />
            </div>
          </div>
        </div>
      </header>
    )
  }

  const { selectedChain, setSelectedChain, isConnecting } = context
  const netProps = {
    selectedChain,
    onSelectChain: setSelectedChain,
    isConnecting,
  } as const

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 safe-area-inset-top">
      <div className="container mx-auto max-w-full overflow-hidden px-2 py-2 sm:px-4 sm:py-3">
        {/* Móvil: título+iconos, luego cuenta, luego red a ancho completo */}
        <div className="flex min-w-0 flex-col gap-2 sm:hidden">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h1 className="min-w-0 flex-1 truncate pr-1 text-base font-bold leading-tight">{t('app.name')}</h1>
            <div className="flex min-w-0 shrink-0 items-center gap-0.5">
              <LanguageSwitcher compact />
              <LogoutButton />
              <HeaderIconActions />
            </div>
          </div>
          <div className="w-full min-w-0">
            <AccountSwitcher className="!max-w-none" />
          </div>
          <div className="w-full min-w-0 max-w-full">
            <NetworkSwitcher {...netProps} className="w-full" />
          </div>
        </div>

        {/* sm+ */}
        <div className="hidden min-w-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <h1 className="shrink-0 text-lg font-bold md:text-xl">{t('app.name')}</h1>
            <div className="min-w-0 max-w-[min(12rem,28vw)] flex-1 sm:max-w-sm md:max-w-md">
              <AccountSwitcher />
            </div>
            <div className="min-w-0 max-w-[min(14rem,32vw)] shrink-0 sm:max-w-sm lg:max-w-md">
              <NetworkSwitcher {...netProps} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
            <LanguageSwitcher />
            <LogoutButton />
            <HeaderIconActions />
          </div>
        </div>
      </div>
    </header>
  )
}
