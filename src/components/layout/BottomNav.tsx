import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Award, Wallet, Settings, Menu, X, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AccountSwitcher } from '@/components/layout/AccountSwitcher'
import { Separator } from '@/components/ui/separator'

const navigation = [
  { id: 'accounts' as const, href: '/accounts', icon: Wallet },
  { id: 'attestations' as const, href: '/attestations', icon: Award },
  { id: 'zkLab' as const, href: '/zk-lab', icon: FlaskConical },
  { id: 'settings' as const, href: '/settings', icon: Settings },
] as const

function pathMatchesItem(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
}

export function BottomNav() {
  const { t } = useTranslation('common')
  const location = useLocation()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const handleNavigation = (href: string) => {
    navigate(href)
    setIsOpen(false)
  }

  return (
    <>
      {/* FAB Button - Posicionado para fácil acceso con el pulgar */}
      <div
        className="fixed bottom-4 right-4 md:hidden z-[100] pointer-events-auto"
        style={{
          bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
          right: 'max(1rem, env(safe-area-inset-right, 1rem))',
        }}
      >
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label={t('bottomNav.openMenu')}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-[70vh] rounded-t-2xl overflow-y-auto"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
            }}
          >
            <SheetHeader>
              <SheetTitle>{t('bottomNav.sheetTitle')}</SheetTitle>
              <SheetDescription>{t('bottomNav.sheetDescription')}</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t('bottomNav.activeAccount')}
                </p>
                <AccountSwitcher className="w-full !max-w-none" showInlineLabel={false} />
              </div>
              <Separator />
            </div>
            <div className="mt-4 space-y-2 pb-4">
              {navigation.map((item) => {
                const isActive = pathMatchesItem(location.pathname, item.href)
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'h-6 w-6 flex-shrink-0',
                        isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'font-medium',
                          isActive ? 'text-primary-foreground' : 'text-foreground'
                        )}
                      >
                        {t(`bottomItems.${item.id}.title`)}
                      </div>
                      <div
                        className={cn(
                          'text-sm mt-0.5',
                          isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                        )}
                      >
                        {t(`bottomItems.${item.id}.description`)}
                      </div>
                    </div>
                    {isActive && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                  </button>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
