import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '@/locales/en/common.json'
import es from '@/locales/es/common.json'
import enPages from '@/locales/en/pages.json'
import esPages from '@/locales/es/pages.json'

const STORAGE_KEY = 'i18n-lang'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en, pages: enPages },
      es: { common: es, pages: esPages },
    },
    defaultNS: 'common',
    ns: ['common', 'pages'],
    fallbackLng: 'es',
    supportedLngs: ['en', 'es'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

i18n.on('initialized', () => {
  document.documentElement.setAttribute('lang', i18n.resolvedLanguage ?? 'es')
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('lang', lng)
})

export default i18n
