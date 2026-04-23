# Yohualli gossip relay (WebSocket)

Servidor mínimo que **reenvía** los mismos JSON de atestación que ya publica la PWA (`AttestationGossipEnvelope`). Cualquier cliente conectado al mismo `wss://` (o `ws://` en local) recibe lo que otros envían; sirve para que **dos instancias de la PWA** (otro puerto, otra máquina, build desplegado + entorno de prueba) compartan gossip sin compartir origen del `BroadcastChannel`.

## Cómo encaja con la PWA

1. En **Atestaciones**, modo transporte **WebSocket relay**.
2. URL del relay:
   - **Local (mismo host que el navegador y el relay):** `ws://127.0.0.1:8080` (o el `PORT` que uses). Solo sirve si la PWA se sirve por **http://** o si el relay expone **wss://**; desde **https://** (p. ej. Vite con mkcert) el navegador **bloquea** `ws://` (mixed content).
   - **Local con `vite dev` / `vite preview`:** si la app va por HTTPS, usá el proxy **`/__yohualli_relay`** (botón **Proxy /__yohualli_relay** en Atestaciones → `wss://<mismo-host-de-Vite>/__yohualli_relay`). Si `curl` al relay funciona pero el WebSocket a `127.0.0.1` falla en HTTP (vista embebida del IDE, etc.), el mismo proxy en **`ws://`** también ayuda. El target HTTP del proxy se ajusta con **`YOHUALLI_RELAY_PROXY_TARGET`** (por defecto `http://127.0.0.1:8080`; por compatibilidad también se lee `VITE_YOHUALLI_RELAY_PROXY_TARGET`).
   - **Producción (PWA en HTTPS):** `wss://…` del host donde corra este proceso detrás de TLS (Railway, Fly.io, Cloudflare Tunnel, etc.). El navegador bloquea `ws://` desde páginas `https://`.

Opcional: variable de entorno en el build de la PWA:

```bash
VITE_YOHUALLI_RELAY_WS=wss://tu-relay.example.com
```

Así la URL viene precargada en Atestaciones.

## Levantar en local

Desde la raíz del repo:

```bash
npm run relay:yohualli
```

O desde esta carpeta:

```bash
cd relay && npm install && npm start
```

Por defecto escucha en **`0.0.0.0:8080`**. Cambiar puerto:

```bash
PORT=9000 npm start
```

Health check: `curl http://127.0.0.1:8080/health` → texto `yohualli-gossip-relay ok`.

Desde otra pestaña (otro puerto de Vite), en consola del navegador podés comprobar que el relay responde:

```js
fetch('http://127.0.0.1:8080/health').then((r) => r.text()).then(console.log)
```

Si falla por red, el WebSocket también fallará.

## Protocolo extendido (buffer, sync, intereses)

La PWA actual envía, además del gossip firmado:

1. **`{ type: 'yohualli/watch', subjects: string[] }`** — lista de direcciones de interés (cuentas locales + sujeto de prueba). El relay **solo reenvía** atestaciones donde **sujeto u atestador** está en `subjects`. Lista vacía = comportamiento “recibir todo” (compatibilidad).
2. **`{ type: 'yohualli/sync', afterSeq: number }`** — al conectar, pide mensajes del buffer con `seq > afterSeq`. El relay responde con **`yohualli/sync_reply`** (`messages`: array de JSON en wire, `latestSeq`).
3. **Wire de gossip** — el relay envía **`{ type: 'yohualli/gossip', seq, body }`** donde `body` es el envelope `AttestationGossipEnvelope` (el cliente aún publica el **JSON plano** del envelope; el relay lo envuelve al fan-out).

Variables: **`RELAY_BUFFER_MAX`** (cantidad de mensajes en memoria, default 400), **`RELAY_VERBOSE=1`** (logs con id de atestación; por defecto solo seq y conteo de peers).

El relay aplica como máximo **`MAX_WATCH = 64`** entradas en `yohualli/watch` (orden de llegada). La PWA construye la lista de intereses con prioridad (cuentas, variantes SS58, QR, sujeto de lab); ver **[`docs/yohualli-gossip-relay-lab.md`](../docs/yohualli-gossip-relay-lab.md)** para el comportamiento completo del cliente, cola, catch-up, reenvío y limitaciones.

### «Receiving end does not exist» (`content.js`)

Eso casi siempre viene de una **extensión de Chrome** (no de esta PWA). Podés ignorarlo o probar en ventana de incógnito sin extensiones.

## Dos PWAs de prueba

1. Terminal A: `npm run relay:yohualli`
2. Terminal B: `npm run dev -- --port 5173` y en `.env.local` (o solo en el campo de Atestaciones) `VITE_YOHUALLI_RELAY_WS=ws://127.0.0.1:8080`
3. Terminal C: `npm run dev -- --port 5174`. En cada pestaña, **Conectar gossip** con WebSocket: podés usar **Proxy /__yohualli_relay** (cada una queda como `ws://127.0.0.1:5173/__yohualli_relay` y `ws://127.0.0.1:5174/__yohualli_relay`) o la misma URL directa `ws://127.0.0.1:8080` si el navegador alcanza el relay.

Ambas deben terminar en el **mismo proceso relay** (puerto 8080 por defecto): las atestaciones publicadas en una deberían **ingerirse** en la otra (deduplicación por id en el grafo local).

## Despliegue con WSS

Este proceso usa **HTTP** interno; en Railway/Fly/Render el **proxy TLS** termina `wss://` y habla `http` con Node. Configurá el servicio con:

- **Start command:** `node index.mjs` (o `npm start` con `cwd` en `relay/`)
- **Variable `PORT`:** la que asigne la plataforma (Railway inyecta `PORT`).

La PWA en GitHub Pages u otro HTTPS usará `wss://<tu-dominio-del-relay>`.

## Seguridad (laboratorio)

No hay autenticación: **cualquiera** que conozca la URL puede conectarse al relay. El filtro por **`watch`** reduce lo que reciben **otros clientes** (no quienes observan el tráfico hacia el relay). El operador del servidor y quien controle la red aún pueden ver **payload en claro** salvo **TLS** (`wss://`). Contra ingeniería social / mapeo de grafos desde fuera hace falta **cifrado extremo-a-extremo**, rotación de tópicos y minimización de metadatos (fuera del alcance de este relay mínimo).

## Docker (opcional)

**Desde la raíz del monorepo** (mismo criterio que Railway con contexto en el repo, no en `relay/` sola):

```bash
docker build -f Dockerfile.relay -t yohualli-relay .
docker run -p 8080:8080 -e PORT=8080 yohualli-relay
```

**Solo con carpeta `relay/`** como contexto (equivale a Railway: servicio con **Root directory = `relay`** y Dockerfile `Dockerfile`):

```bash
docker build -t yohualli-relay ./relay
docker run -p 8080:8080 -e PORT=8080 yohualli-relay
```

Si Railway construyó con la raíz del repositorio y un Dockerfile que hace `COPY package.json` sin prefijo, falla: usá `Dockerfile.relay` en la raíz, **o** Root directory `relay` y el `Dockerfile` de esta carpeta.
