import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const LANGS = ['es', 'en'] as const

type LanguageSwitcherProps = {
  /** Fila apretada en móvil: solo código ES/EN, sin etiqueta. */
  compact?: boolean
}

/**
 * Conmutador de idioma (Español / English). Persite en `localStorage` (clave `i18n-lang` vía detector de i18next).
 */
export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation('common')
  const code = (i18n.resolvedLanguage ?? 'es').split('-')[0]
  const value = LANGS.includes(code as (typeof LANGS)[number]) ? code : 'es'

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" title={t('lang.label')}>
      <span className="text-muted-foreground text-xs hidden sm:inline">{t('lang.label')}</span>
      <Select
        value={value}
        onValueChange={(v) => {
          void i18n.changeLanguage(v)
        }}
      >
        <SelectTrigger
          className={
            compact
              ? 'h-8 w-[2.75rem] shrink-0 px-1.5 text-xs font-semibold tabular-nums'
              : 'h-8 w-[7.5rem] sm:w-[9.5rem] text-xs'
          }
          aria-label={t('lang.label')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGS.map((lng) => (
            <SelectItem key={lng} value={lng} className="text-xs">
              {compact ? lng.toUpperCase() : t(`lang.${lng}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
