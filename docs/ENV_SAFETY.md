# Entorno, secretos y CLI (sin dejar claves en el historial)

## Reglas

1. **Nunca** definas con prefijo `VITE_` mnemónicas, *private key* o tokens. Vite expone `VITE_*` al *bundle* del front; con DevTools o el artefacto de *build* quedan alcanzables.
2. **Forge, relé, scripts Node** (RPC, `PRIVATE_KEY`, `MNEMONIC`, *derive* *lab*): usad **`.env.forge.local`** o el **toolbox** que inyecta el *env* al subproceso, no variables `VITE_`.
3. Evitad `export KEY=0x… && yarn run …` en una sola línea reutilizable (historial del *shell*). Preferid `yarn yoh:toolbox run <script>`.

## Archivos

| Archivo | Uso | ¿En git? |
|--------|-----|----------|
| [`.env.example`](../.env.example) | Plantilla solo con `VITE_*` y campos *públicos* | Sí |
| `.env.local` | Copia local; `cp .env.example` y ajustar | No |
| [`.env.forge.example`](../.env.forge.example) | Plantilla sin `VITE_` (RPC, claves) | Sí |
| `.env.forge.local` | Credenciales reales; `chmod 600` en Unix | No |

## `yarn yoh:toolbox`

- `init` — crea `.env.local` y `.env.forge.local` a partir de las plantillas, si aún no existen.
- `check` — muestra qué archivos se cargan y nombres de claves; los secretos se resumen con un hash, no con el valor.
- `run <script>` — fusiona ambos *env* (las variables ya exportadas en el *shell* pisan el archivo) y ejecuta `yarn run <script>` (p. ej. `evm:forge:merkle`). Si definís `YOHUALLI_LAB_MNEMONIC` en `.env.forge.local`, `run lab:derive-evm-roles` no pasa la frase por *stdout* del *shell*.
- `derive-interactive` — pide frase o ruta a un archivo; lo más seguro sigue siendo archivo con permisos mínimos o *solo* variable en *forge* *local*.

Testnet: [YOHUALLI_TESTNET_OPERATIVO.md](./YOHUALLI_TESTNET_OPERATIVO.md). Aura + Yohualli: [docs/aura/README.md](./aura/README.md).
