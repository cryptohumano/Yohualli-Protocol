import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Home, Wallet, Send, FileText, Settings, Menu, X, Mountain } from 'lucide-react'
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
  { name: 'Inicio', href: '/', icon: Home, description: 'Ver resumen de cuentas y balances' },
  { name: 'Cuentas', href: '/accounts', icon: Wallet, description: 'Gestionar tus cuentas' },
  { name: 'Enviar', href: '/send', icon: Send, description: 'Enviar tokens' },
  { name: 'Documentos', href: '/documents', icon: FileText, description: 'Gestionar documentos' },
  { name: 'Bitácoras de Montañismo', href: '/mountain-logs', icon: Mountain, description: 'Registrar expediciones de montañismo' },
  { name: 'Configuración', href: '/settings', icon: Settings, description: 'Ajustes y preferencias' },
]

export function BottomNav() {
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
              aria-label="Abrir menú de navegación"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
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
              <SheetTitle>Navegación</SheetTitle>
              <SheetDescription>
                Cuenta activa y atajos de pantallas
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Cuenta activa (Substrate)</p>
                <AccountSwitcher className="w-full !max-w-none" showInlineLabel={false} />
              </div>
              <Separator />
            </div>
            <div className="mt-4 space-y-2 pb-4">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    )}
                  >
                    <item.icon className={cn(
                      'h-6 w-6 flex-shrink-0',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'font-medium',
                        isActive ? 'text-primary-foreground' : 'text-foreground'
                      )}>
                        {item.name}
                      </div>
                      <div className={cn(
                        'text-sm mt-0.5',
                        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}>
                        {item.description}
                      </div>
                    </div>
                    {isActive && (
                      <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                    )}
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

