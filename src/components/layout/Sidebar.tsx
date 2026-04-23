import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Home,
  Wallet,
  Send,
  QrCode,
  History,
  Network,
  Users,
  FileText,
  Plane,
  Heart,
  Award,
  Mountain,
  Settings,
  FlaskConical,
} from 'lucide-react'

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Cuentas', href: '/accounts', icon: Wallet },
  { name: 'Enviar', href: '/send', icon: Send },
  { name: 'Recibir', href: '/receive', icon: QrCode },
  { name: 'Transacciones', href: '/transactions', icon: History },
  { name: 'Redes', href: '/networks', icon: Network },
  { name: 'Contactos', href: '/contacts', icon: Users },
  { name: 'Documentos', href: '/documents', icon: FileText },
  { name: 'Flight Logs', href: '/flight-logs', icon: Plane },
  { name: 'Bitácoras de Montañismo', href: '/mountain-logs', icon: Mountain },
  { name: 'Expedientes Médicos', href: '/medical-records', icon: Heart },
  { name: 'Atestaciones', href: '/attestations', icon: Award },
  { name: 'ZK Lab', href: '/zk-lab', icon: FlaskConical },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:top-16 border-r bg-background">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

