/**
 * Solo desarrollo: http://IP-LAN no es un contexto seguro → sin Web Crypto (subtle).
 */
export function InsecureContextBanner() {
  if (!import.meta.env.DEV) return null
  if (typeof window === 'undefined' || window.isSecureContext) return null

  return (
    <div
      role="alert"
      className="shrink-0 border-b border-amber-600/80 bg-amber-950/95 px-3 py-2 text-xs text-amber-50 shadow-md sm:text-sm"
    >
      <strong className="block sm:inline">Contexto no seguro (HTTP).</strong>{' '}
      <code className="rounded bg-black/30 px-1">crypto.subtle</code> no está disponible en el móvil salvo HTTPS o
      localhost en <em>este</em> dispositivo. En el teléfono, <code className="rounded bg-black/30 px-1">localhost</code>{' '}
      apunta al propio móvil, no a tu PC: usa la IP local del ordenador con{' '}
      <strong>HTTPS</strong> (<code className="rounded bg-black/30 px-1">bash scripts/setup-https.sh</code> y{' '}
      <code className="rounded bg-black/30 px-1">yarn dev</code>).
    </div>
  )
}
