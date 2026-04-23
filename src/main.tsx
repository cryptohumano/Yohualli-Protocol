// Polyfills para Node.js modules en el navegador
import { Buffer } from 'buffer'
window.Buffer = Buffer
globalThis.Buffer = Buffer

// Polyfill para crypto.randomUUID si no está disponible
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}

// Verificar que crypto.subtle esté disponible (p. ej. móvil en http://IP-LAN → usar HTTPS + mkcert)
if (typeof crypto === 'undefined' || !crypto.subtle) {
  console.error(
    '⚠️ crypto.subtle no disponible: en el móvil usa https://IP-de-tu-PC:5173 tras bash scripts/setup-https.sh (http://IP no es contexto seguro).'
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { KeyringProvider } from './contexts/KeyringContext'
import { NetworkProvider } from './contexts/NetworkContext'
import { Toaster } from '@/components/ui/sonner'
import { InsecureContextBanner } from '@/components/dev/InsecureContextBanner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="flex min-h-screen flex-col">
      <InsecureContextBanner />
      <KeyringProvider>
        <NetworkProvider>
          <RouterProvider router={router} />
          <Toaster />
        </NetworkProvider>
      </KeyringProvider>
    </div>
  </StrictMode>,
)

