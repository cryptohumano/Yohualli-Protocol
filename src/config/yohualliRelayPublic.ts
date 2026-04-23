/**
 * URL `wss://` del relay desplegado (p. ej. Railway) para un botón de acceso rápido
 * en Atestaciones. Configurar en `.env` / el panel del host (p. ej. Vercel) con
 * `VITE_YOHUALLI_RELAY_RAILWAY=wss://…` (público; no secretos en `VITE_`).
 */
export function getYohualliRelayRailwayUrl(): string {
  const raw = import.meta.env.VITE_YOHUALLI_RELAY_RAILWAY
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

/**
 * URL por defecto para Atestaciones: `VITE_YOHUALLI_RELAY_WS`, si no, Railway.
 * En el componente, en `dev` y sin la anterior, se rellena con el proxy de Vite (cliente).
 */
export function getDefaultYohualliRelayWsForAttestations(): string {
  const ws = (import.meta.env.VITE_YOHUALLI_RELAY_WS as string | undefined)?.trim() ?? ''
  if (ws) return ws
  return getYohualliRelayRailwayUrl()
}
