/**
 * Relay Yohualli: fan-out con buffer (catch-up), filtro por intereses y envoltorio con `seq`.
 * Los clientes actualizados envían `yohualli/watch` + `yohualli/sync`; el relay reenvía gossip
 * solo a quienes tienen sujeto o atestador en su lista de interés (si la definieron).
 *
 * Variables: PORT, RELAY_BUFFER_MAX (default 400), RELAY_VERBOSE=1 (logs con id; por defecto mínimo).
 */
import http from 'http'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT || 8080)
const BUFFER_MAX = Math.min(5000, Math.max(50, Number(process.env.RELAY_BUFFER_MAX || '400', 10) || 400))
const VERBOSE = process.env.RELAY_VERBOSE === '1' || process.env.RELAY_VERBOSE === 'true'
const MAX_WATCH = 64
const MAX_ADDR_LEN = 120

let nextSeq = 1
/** @type {{ seq: number, payload: string }[]} */
const buffer = []

function isGossipEnvelope(data) {
  return (
    data &&
    data.schemaVersion === 1 &&
    typeof data.topic === 'string' &&
    data.topic.startsWith('yohualli/') &&
    data.attestation &&
    typeof data.attestation.id === 'string'
  )
}

function interestMatches(data, interestSet) {
  if (!interestSet) return true
  const sub = data.attestation?.subjectAddress
  const att = data.attestation?.attesterAddress
  return (sub && interestSet.has(sub)) || (att && interestSet.has(att))
}

function wrapGossip(seq, bodyObj) {
  return JSON.stringify({ type: 'yohualli/gossip', seq, body: bodyObj })
}

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendCors(res)
    res.writeHead(204).end()
    return
  }
  const path = req.url?.split('?')[0] ?? '/'
  if (path === '/' || path === '/health') {
    sendCors(res)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('yohualli-gossip-relay ok\n')
    return
  }
  res.writeHead(404).end()
})

const wss = new WebSocketServer({ server })

function trimBuffer() {
  while (buffer.length > BUFFER_MAX) buffer.shift()
}

/**
 * @param {import('ws').WebSocket} sourceWs
 * @param {object} data
 */
function recordAndFanOut(sourceWs, data) {
  const seq = nextSeq++
  const payload = wrapGossip(seq, data)
  buffer.push({ seq, payload })
  trimBuffer()

  let n = 0
  for (const client of wss.clients) {
    if (client === sourceWs || client.readyState !== 1) continue
    const set = client._interestSet
    if (!interestMatches(data, set)) continue
    client.send(payload)
    n += 1
  }
  if (VERBOSE && n > 0) {
    console.log(`[yohualli-gossip-relay] fan-out seq=${seq} id=${data.attestation?.id ?? '?'} → ${n} peer(s)`)
  } else if (!VERBOSE && n > 0) {
    console.log(`[yohualli-gossip-relay] fan-out seq=${seq} → ${n} peer(s)`)
  }
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {number} afterSeq
 */
function handleSync(ws, afterSeq) {
  const out = []
  let latest = nextSeq > 1 ? nextSeq - 1 : 0
  for (const row of buffer) {
    if (row.seq <= afterSeq) continue
    try {
      const outer = JSON.parse(row.payload)
      if (outer.type !== 'yohualli/gossip' || !outer.body) continue
      if (!isGossipEnvelope(outer.body)) continue
      if (!interestMatches(outer.body, ws._interestSet)) continue
      out.push(row.payload)
    } catch {
      /* ignore */
    }
  }
  try {
    ws.send(JSON.stringify({ type: 'yohualli/sync_reply', messages: out, latestSeq: latest }))
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {unknown[]} subjects
 */
function handleWatch(ws, subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    ws._interestSet = undefined
    return
  }
  const set = new Set()
  let n = 0
  for (const s of subjects) {
    if (n >= MAX_WATCH) break
    if (typeof s !== 'string') continue
    const t = s.trim()
    if (!t || t.length > MAX_ADDR_LEN) continue
    set.add(t)
    n += 1
  }
  ws._interestSet = set.size > 0 ? set : undefined
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress ?? '?'
  ws._interestSet = undefined
  console.log(`[yohualli-gossip-relay] client +1 (${wss.clients.size} total) from ${ip}`)

  ws.on('close', () => {
    console.log(`[yohualli-gossip-relay] client -1 (${wss.clients.size} total)`)
  })

  ws.on('message', (raw, isBinary) => {
    if (isBinary) return
    const text = raw.toString()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return
    }
    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t: data.t ?? null }))
      return
    }
    if (data.type === 'yohualli/sync' && typeof data.afterSeq === 'number') {
      handleSync(ws, Math.floor(data.afterSeq))
      return
    }
    if (data.type === 'yohualli/watch' && Array.isArray(data.subjects)) {
      handleWatch(ws, data.subjects)
      return
    }
    if (data.type === 'yohualli/gossip') {
      return
    }
    if (!isGossipEnvelope(data)) return
    recordAndFanOut(ws, data)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[yohualli-gossip-relay] listening on 0.0.0.0:${PORT} buffer=${BUFFER_MAX} verbose=${VERBOSE}`)
})
