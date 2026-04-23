import type { GraphNode, SocialAttestation } from '@/social-graph/types/graph'
import { STORES, openYohualliGraphDB } from '@/social-graph/indexedGraphDB'

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction error'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction abort'))
  })
}

export class YohualliGraphRepository {
  async upsertNode(node: GraphNode): Promise<void> {
    const db = await openYohualliGraphDB()
    const tx = db.transaction(STORES.nodes, 'readwrite')
    tx.objectStore(STORES.nodes).put(node)
    await txDone(tx)
  }

  async getNode(nodeId: string): Promise<GraphNode | undefined> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.nodes, 'readonly')
      const req = tx.objectStore(STORES.nodes).get(nodeId)
      req.onsuccess = () => resolve(req.result as GraphNode | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  async putAttestation(att: SocialAttestation): Promise<void> {
    const db = await openYohualliGraphDB()
    const now = Date.now()
    const prevSubject = await this.getNode(att.subjectAddress)
    const prevAttester = await this.getNode(att.attesterAddress)
    const mk = (id: string, prev?: GraphNode): GraphNode =>
      prev ? { ...prev, lastSeenAt: now } : { nodeId: id, firstSeenAt: now, lastSeenAt: now }
    const tx = db.transaction([STORES.nodes, STORES.attestations], 'readwrite')
    tx.objectStore(STORES.nodes).put(mk(att.subjectAddress, prevSubject))
    tx.objectStore(STORES.nodes).put(mk(att.attesterAddress, prevAttester))
    tx.objectStore(STORES.attestations).put(att)
    await txDone(tx)
  }

  async getAttestation(id: string): Promise<SocialAttestation | undefined> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.attestations, 'readonly')
      const req = tx.objectStore(STORES.attestations).get(id)
      req.onsuccess = () => resolve(req.result as SocialAttestation | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  async countNodes(): Promise<number> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.nodes, 'readonly')
      const req = tx.objectStore(STORES.nodes).count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async countAttestations(): Promise<number> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.attestations, 'readonly')
      const req = tx.objectStore(STORES.attestations).count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Todas las atestaciones guardadas, ordenadas por `timestampMs` (más recientes primero).
   * Cada firma con distinto instante genera otra fila (misma pareja de cuentas puede repetirse).
   */
  async listAllAttestationsOrdered(descending = true): Promise<SocialAttestation[]> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.attestations, 'readonly')
      const index = tx.objectStore(STORES.attestations).index('byTimestamp')
      const out: SocialAttestation[] = []
      const dir = descending ? ('prev' as IDBCursorDirection) : ('next' as IDBCursorDirection)
      const req = index.openCursor(null, dir)
      req.onsuccess = () => {
        const c = req.result
        if (c) {
          out.push(c.value as SocialAttestation)
          c.continue()
        } else {
          resolve(out)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }

  /** Aristas donde el nodo es sujeto o atestador */
  /**
   * Última atestación atestador→sujeto (cualquier contexto), por mayor `timestampMs`.
   * Escaneo por índice `byAttester` (aceptable en lab).
   */
  async findLatestAttestationAttesterToSubject(
    attesterAddress: string,
    subjectAddress: string
  ): Promise<SocialAttestation | undefined> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.attestations, 'readonly')
      const index = tx.objectStore(STORES.attestations).index('byAttester')
      let best: SocialAttestation | undefined
      const req = index.openCursor(IDBKeyRange.only(attesterAddress))
      req.onsuccess = () => {
        const c = req.result
        if (c) {
          const a = c.value as SocialAttestation
          if (a.subjectAddress === subjectAddress && (!best || a.timestampMs > best.timestampMs)) best = a
          c.continue()
        } else resolve(best)
      }
      req.onerror = () => reject(req.error)
    })
  }

  /** Cuenta aristas dirigidas atestador→sujeto con `timestampMs` en [sinceMs, untilMs]. */
  async countDirectedAttestationsInRange(
    attesterAddress: string,
    subjectAddress: string,
    sinceMs: number,
    untilMs: number
  ): Promise<number> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.attestations, 'readonly')
      const index = tx.objectStore(STORES.attestations).index('byAttester')
      let n = 0
      const req = index.openCursor(IDBKeyRange.only(attesterAddress))
      req.onsuccess = () => {
        const c = req.result
        if (c) {
          const a = c.value as SocialAttestation
          if (
            a.subjectAddress === subjectAddress &&
            a.timestampMs >= sinceMs &&
            a.timestampMs <= untilMs
          ) {
            n += 1
          }
          c.continue()
        } else resolve(n)
      }
      req.onerror = () => reject(req.error)
    })
  }

  /** Atestaciones hacia `subjectAddress` en [sinceMs, untilMs] (cualquier atestador). */
  async countInboundToSubjectInRange(subjectAddress: string, sinceMs: number, untilMs: number): Promise<number> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.attestations, 'readonly')
      const index = tx.objectStore(STORES.attestations).index('bySubject')
      let n = 0
      const req = index.openCursor(IDBKeyRange.only(subjectAddress))
      req.onsuccess = () => {
        const c = req.result
        if (c) {
          const a = c.value as SocialAttestation
          if (a.timestampMs >= sinceMs && a.timestampMs <= untilMs) n += 1
          c.continue()
        } else resolve(n)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async getAttestationsTouchingNode(nodeId: string): Promise<SocialAttestation[]> {
    const db = await openYohualliGraphDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.attestations, 'readonly')
      const store = tx.objectStore(STORES.attestations)
      const out: SocialAttestation[] = []
      let pending = 2
      const done = () => {
        pending -= 1
        if (pending === 0) resolve(out)
      }
      const seen = new Set<string>()
      const push = (a: SocialAttestation) => {
        if (!seen.has(a.id)) {
          seen.add(a.id)
          out.push(a)
        }
      }
      const bySubject = store.index('bySubject').openCursor(IDBKeyRange.only(nodeId))
      bySubject.onsuccess = () => {
        const c = bySubject.result
        if (c) {
          push(c.value as SocialAttestation)
          c.continue()
        } else done()
      }
      bySubject.onerror = () => reject(bySubject.error)

      const byAttester = store.index('byAttester').openCursor(IDBKeyRange.only(nodeId))
      byAttester.onsuccess = () => {
        const c = byAttester.result
        if (c) {
          push(c.value as SocialAttestation)
          c.continue()
        } else done()
      }
      byAttester.onerror = () => reject(byAttester.error)
    })
  }

  async clearAll(): Promise<void> {
    const db = await openYohualliGraphDB()
    const tx = db.transaction([STORES.nodes, STORES.attestations], 'readwrite')
    tx.objectStore(STORES.nodes).clear()
    tx.objectStore(STORES.attestations).clear()
    await txDone(tx)
  }

  async markLocalNode(nodeId: string, isLocal: boolean): Promise<void> {
    const db = await openYohualliGraphDB()
    const tx = db.transaction(STORES.nodes, 'readwrite')
    const store = tx.objectStore(STORES.nodes)
    const req = store.get(nodeId)
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const prev = req.result as GraphNode | undefined
        const now = Date.now()
        const node: GraphNode = prev
          ? { ...prev, isLocal, lastSeenAt: now }
          : { nodeId, firstSeenAt: now, lastSeenAt: now, isLocal }
        store.put(node)
        resolve()
      }
      req.onerror = () => reject(req.error)
    })
    await txDone(tx)
  }
}

export const defaultYohualliGraphRepository = new YohualliGraphRepository()
