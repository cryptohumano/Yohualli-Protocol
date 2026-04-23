/**
 * Base IndexedDB dedicada al grafo Yohualli (separada del keyring compartido).
 */

const DB_NAME = 'aura-yohualli-graph'
const DB_VERSION = 1

export const STORES = {
  nodes: 'yohualli-nodes',
  attestations: 'yohualli-attestations',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

export function openYohualliGraphDB(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB no disponible'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onerror = () => reject(req.error ?? new Error('Error al abrir aura-yohualli-graph'))
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORES.nodes)) {
          const nodeStore = db.createObjectStore(STORES.nodes, { keyPath: 'nodeId' })
          nodeStore.createIndex('byLastSeen', 'lastSeenAt', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORES.attestations)) {
          const attStore = db.createObjectStore(STORES.attestations, { keyPath: 'id' })
          attStore.createIndex('bySubject', 'subjectAddress', { unique: false })
          attStore.createIndex('byAttester', 'attesterAddress', { unique: false })
          attStore.createIndex('byTimestamp', 'timestampMs', { unique: false })
        }
      }
    })
  }
  return dbPromise
}

export function closeYohualliGraphDBForTests(): void {
  dbPromise = null
}
