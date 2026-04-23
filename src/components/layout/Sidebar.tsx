import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  { key: 'nav.home' as const, href: '/', icon: Home },
  { key: 'nav.accounts' as const, href: '/accounts', icon: Wallet },
  { key: 'nav.send' as const, href: '/send', icon: Send },
  { key: 'nav.receive' as const, href: '/receive', icon: QrCode },
  { key: 'nav.tx' as const, href: '/transactions', icon: History },
  { key: 'nav.networks' as const, href: '/networks', icon: Network },
  { key: 'nav.contacts' as const, href: '/contacts', icon: Users },
  { key: 'nav.documents' as const, href: '/documents', icon: FileText },
  { key: 'nav.flightLogs' as const, href: '/flight-logs', icon: Plane },
  { key: 'nav.mountain' as const, href: '/mountain-logs', icon: Mountain },
  { key: 'nav.medical' as const, href: '/medical-records', icon: Heart },
  { key: 'nav.attestations' as const, href: '/attestations', icon: Award },
  { key: 'nav.zkLab' as const, href: '/zk-lab', icon: FlaskConical },
  { key: 'nav.settings' as const, href: '/settings', icon: Settings },
] as const

export function Sidebar() {
  const location = useLocation()
  const { t } = useTranslation('common')

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:top-16 border-r bg-background">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.key}
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
                {t(item.key)}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
