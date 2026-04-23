# Yohualli gossip por relay WebSocket (laboratorio)

Documentación del **estado implementado** en este repositorio: relay Node (`relay/`), transporte y nodo de gossip en la PWA (`src/social-graph/`), y la pantalla **Atestaciones**. No sustituye el borrador de protocolo (`Yohualli Protocol draft 1.1.md`); complementa el **lab operativo** para reproducir pruebas entre pestañas, dispositivos o despliegues.

## Objetivo

- Difundir **atestaciones firmadas** (`AttestationGossipEnvelope`) entre instancias de la PWA que no comparten `BroadcastChannel`.
- Permitir **catch-up** tras desconexión mediante un buffer en memoria en el relay.
- Reducir exposición entre pares con un filtro **`watch`** por direcciones de interés (comparación **literal** de strings en el relay).
- En la PWA: cola local si no hay socket, reenvío de firmas ya guardadas al pasar a WebSocket, estado de transmisión en el historial, y acciones manuales de sincronización.

## Arquitectura

```text
[PWA A]  --wss/ws-->  [Relay]  <--wss/ws--  [PWA B]
   |                      |
 IndexedDB            buffer RAM
 grafo local          (RELAY_BUFFER_MAX)
```

- El relay **no** persiste atestaciones en disco; reiniciar el proceso **vacía** el buffer.
- Cada PWA mantiene el **grafo local** en IndexedDB; la deduplicación es por **`attestation.id`** al ingerir.

## Tier-SybilRank (vecindario, distinto del gossip)

La vista de vecindario y el color **SybilRank** en el grafo usan **`computeTierSybilRank`** (`sybilRankTiers.ts`): un **PageRank personalizado** con teleport a semillas por tier emitido y trusted de lab, **no** el Private SybilRank completo del borrador de protocolo (conductancia, ZK, etc.). La base matemática paso a paso está en **[`yohualli-tier-sybilrank-matematica.md`](yohualli-tier-sybilrank-matematica.md)**; el borrador §4.1 enlaza esa nota como **implementación de laboratorio**.

## Protocolo en el wire (relay + cliente actual)

### Mensajes de control (cliente → relay)

| Tipo | Campos | Efecto en el relay |
|------|--------|-------------------|
| `yohualli/watch` | `subjects: string[]` | Si el array tiene longitud **> 0**, se guarda un `Set` con hasta **64** strings (trim, longitud máxima por entrada acotada). Si el array está **vacío**, se interpreta como **sin filtro** (recibir todo el gossip y todo lo aplicable del buffer en `sync`). |
| `yohualli/sync` | `afterSeq: number` | Respuesta `yohualli/sync_reply` con mensajes del buffer cuyo `seq > floor(afterSeq)`, **filtrados** por el mismo criterio de intereses que el fan-out. |
| `ping` / `pong` | — | Mantenimiento de conexión. |

### Gossip (cliente → relay → otros clientes)

- El cliente envía el **JSON plano** del envelope (`schemaVersion`, `topic`, `attestation`, …) por el mismo WebSocket.
- El relay asigna un **`seq`** monotónico, guarda en buffer y hace fan-out como:

```json
{ "type": "yohualli/gossip", "seq": <n>, "body": <AttestationGossipEnvelope> }
```

### Criterio de filtro (relay)

Para cada mensaje, el cuerpo debe ser un envelope válido (`topic` bajo `yohualli/`, `attestation.id`, etc.). Se considera “de interés” para un socket si:

- no hay conjunto de intereses (`watch` vacío), **o**
- `attestation.subjectAddress` **o** `attestation.attesterAddress` está **literalmente** en el `Set` del cliente.

**Importante:** el relay **no** normaliza SS58 ni compara por clave pública. La PWA mitiga enviando en `watch` **varias codificaciones** del mismo pubkey (prefijos habituales 42, 0, 2, 5) y direcciones `dualSubstrateSs58` cuando existen; ver `src/social-graph/p2p/relayInterestAddresses.ts` y el límite **64** entradas alineado con `MAX_WATCH` en `relay/index.mjs`.

### Variables de entorno del relay

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `8080` | Puerto HTTP/WebSocket. |
| `RELAY_BUFFER_MAX` | `400` | Tamaño máximo del buffer (acotado entre 50 y 5000). |
| `RELAY_VERBOSE` | off | Con `1` o `true`, logs incluyen id de atestación en fan-out. |

## Cliente PWA (`WebSocketGossipTransport`)

Archivo principal: `src/social-graph/p2p/websocketGossipTransport.ts`.

- **`interestAddresses`**: se traduce en `yohualli/watch` al abrir el socket (máx. 64 entradas).
- **`sessionStorage`**: clave por URL del relay para el último `seq` visto (`yohualli-relay-seq:…`), usado como `afterSeq` en el primer `sync` tras conectar.
- **Cola `pendingOutbox`**: si `publish` se llama sin `WebSocket.OPEN`, el envelope queda en memoria hasta `sync_reply` o un timeout corto que dispara `flushPendingOutbox`.
- **`sync_reply`**: el cliente **solo** avanza el cursor de `seq` en almacenamiento al procesar mensajes que efectivamente parsea e ingiere; **no** debe usar solo `latestSeq` del relay cuando la lista `messages` vino vacía por filtro, para no “saltar” gossip nunca recibido.
- **`requestCatchupFromZero()`**: escribe `0` en el cursor local, reenvía `sync` y reprograma el fallback; devuelve `false` si el socket no está abierto.

## Nodo `YohualliGossipNode`

Archivo: `src/social-graph/yohualliGossipNode.ts`.

- **`start()`**: `connect`, registra `setOnGossip` **antes** de `waitUntilReady` para no perder mensajes del primer `sync_reply`.
- **`publishAttestation`**: ingiere en el grafo local y llama `transport.publish`.
- **`replayUnsentLocalAttestationsToRelay`**: recorre el historial local y vuelve a publicar lo firmado por cuentas indicadas que el transporte WSS **no** haya marcado aún como enviado (cubre el caso “firmé con BroadcastChannel / sin relay y luego pasé a WebSocket”).
- **`getOutboundAttestationStatus`**: delegado al transporte (memoria de sesión: `queued` / `sent` y derivación online/offline).

## Pantalla Atestaciones

Archivo: `src/pages/Attestations.tsx`.

- Transporte por defecto: **BroadcastChannel**; para relay hay que elegir **WebSocket** y una URL válida.
- Tras firmar, se usa siempre **`publishAttestation`** (también con gossip apagado) para que, con WSS, la firma **entre en cola** si no hay socket.
- Al conectar gossip con WSS, se llama automáticamente a **`replayUnsentLocalAttestationsToRelay`** para reenviar firmas locales pendientes.
- Botones de lab:
  - **Reenviar firmas locales al relay**: mismo replay, manual.
  - **Catch-up relay desde cero**: `requestCatchupFromZero` (útil para el sujeto u otra pestaña tras corregir intereses o cursor).
- Tabla **Historial de atestaciones**: columna **Gossip (saliente)** con estado aproximado para filas donde vos sos el atestador y el transporte es WSS (memoria de sesión; no persiste al recargar).

## Modelo de amenazas (lab, resumido)

- **Operador del relay** y quien pueda inspeccionar el tráfico hacia el relay ven el **payload en claro** (salvo TLS hasta el relay).
- El filtro **`watch`** limita lo que reciben **otros clientes** del mismo relay, no oculta datos al operador ni a un adversario de red global.
- Sin autenticación de clientes: la URL del relay actúa como secreto débil de lab.

## Cómo probar (checklist breve)

1. Levantar relay: `npm run relay:yohualli` (puerto según `PORT`).
2. Dos instancias de la PWA (o dos puertos de Vite), **misma URL** de relay; con HTTPS local usar proxy **`/__yohualli_relay`** si hace falta.
3. En ambas: transporte **WebSocket**, **Conectar gossip**.
4. Firmar en A; comprobar ingesta en B si **sujeto o atestador** están en la lista de intereses de B (cuentas locales + variantes SS58).
5. Desconectar A, firmar (o encolar), reconectar: catch-up desde buffer si no expiró.
6. Sujeto: usar **Catch-up relay desde cero** si hace falta tras vaciar buffer del relay o corregir intereses.

## Referencia rápida de archivos

| Área | Ruta |
|------|------|
| Relay | `relay/index.mjs`, `relay/README.md` |
| Transporte WSS | `src/social-graph/p2p/websocketGossipTransport.ts` |
| Intereses SS58 | `src/social-graph/p2p/relayInterestAddresses.ts` |
| Interfaz transporte | `src/social-graph/p2p/gossipTransport.ts` |
| Tipos gossip | `src/social-graph/p2p/gossipTypes.ts` |
| Nodo | `src/social-graph/yohualliGossipNode.ts` |
| UI | `src/pages/Attestations.tsx` |
| Tier-SybilRank (matemática) | `docs/yohualli-tier-sybilrank-matematica.md`, `src/social-graph/sybilRankTiers.ts` |
| Proxy Vite | `vite.config.ts` (ruta `__yohualli_relay`, `YOHUALLI_RELAY_PROXY_TARGET`) |

## Compatibilidad relay antiguo

Un relay que solo hace fan-out del JSON plano (sin buffer ni `sync_reply`) sigue pudiendo recibir **publicaciones** planas desde un cliente antiguo; el cliente nuevo espera envoltorio `yohualli/gossip` + `sync_reply` para catch-up y filtrado coherente. Conviene **desplegar relay y PWA del mismo “salto”** de funciones para lab.
