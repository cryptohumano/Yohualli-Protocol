const BB_WASM_SHORT = /^WASM Barretenberg:/

/**
 * El abort del lab por `@aztec/bb.js` WASM: no añadimos `stack` (poco útil) ni tips de worker/hilo.
 */
function isBbJsWAsmLabBlockerMessage(message: string): boolean {
  return BB_WASM_SHORT.test(message.trimStart())
}

/**
 * Evita duplicar el texto: en V8 `error.stack` suele empezar con `Error: <message>`;
 * al concatenar `message + stack` se lee dos veces la misma explicación.
 */
export function formatProveLabErrorForUi(message: string, stack?: string): string {
  if (isBbJsWAsmLabBlockerMessage(message)) {
    return message
  }
  if (!stack?.trim()) {
    return message
  }
  const lines = stack.split('\n')
  const first = (lines[0] ?? '').trim()
  if (first === `Error: ${message}` || first === message) {
    return [message, ...lines.slice(1).filter((l) => l.length > 0)].join('\n')
  }
  return `${message}\n${stack}`
}

/**
 * Sufijos Merkle: «hilo principal» / nargo / puerto 64926 solo si el fallo *no* es el bloqueo
 * conocido del WASM (en ese caso falla igual en worker o main).
 */
export function zkLabMerkleErrorSuffix(message: string, branch: 'worker' | 'main'): string {
  if (isBbJsWAsmLabBlockerMessage(message)) {
    return ''
  }
  if (branch === 'worker') {
    return (
      '\n\nTip: probá «Generar en hilo principal» si el fallo es del Web Worker.' + zkLabVitePortHintIfRelevant()
    )
  }
  return '\n\nSi el circuito es demasiado grande para el navegador, usá `nargo` + `bb prove` en la máquina de dev.'
}

/**
 * Sufijos opcionales para el Zk lab (p. ej. túnel Cursor) sin molestar a quien usa :5173 real.
 */
export function zkLabVitePortHintIfRelevant(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  if (window.location.port === '64926') {
    return '\n\nNota: si usás el túnel :64926, abrí también el dev server en la URL con IP/puerto real (p. ej. :5173).'
  }
  return ''
}
