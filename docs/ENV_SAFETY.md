# Environment, secrets, and the CLI (env / *toolbox*)

*Bilingual: **English** and **Español (América Latina)**. Spanish uses neutral tú, no voseo.*

---

## English

### Rules

1. **Never** put mnemonics, **private keys**, or auth **tokens** behind the `VITE_` prefix. Vite inlines `VITE_*` into the **browser bundle**; it is reachable in devtools or build output.
2. For **Foundry, relay, Node lab scripts** (`RPC_URL`, `PRIVATE_KEY`, `MNEMONIC`, *derive* *lab*): use **`.env.forge.local`** (gitignored) or the **toolbox** to inject the environment into a subprocess — not `VITE_` variables.
3. Avoid a reusable one-liner `export KEY=0x… && yarn run …` in your **shell history**. Prefer `yarn yoh:toolbox run <script>`.

### Files

| File | Use | In git? |
|------|-----|--------|
| [`.env.example`](../.env.example) | Template: only public `VITE_*` and addresses | Yes |
| `.env.local` | Your copy: `cp .env.example` and fill in | No |
| [`.env.forge.example`](../.env.forge.example) | Non-`VITE_` (RPC, keys) template | Yes |
| `.env.forge.local` | Real secrets; `chmod 600` on Unix | No |

### `yarn yoh:toolbox`

- **`init`** — creates `.env.local` and `.env.forge.local` from the templates (if missing).  
- **`check`** — shows which files load, key names, and a short **hash** for secret values (not the value).  
- **`run <script>`** — merges *forge* and *local* env, then `yarn run <script>` (e.g. `evm:forge:merkle`). Already-exported shell variables override file content. If `YOHUALLI_LAB_MNEMONIC` lives in `.env.forge.local` only, `run lab:derive-evm-roles` does not echo the phrase to the shell.  
- **`derive-interactive`** — prompts for phrase or file path; safest remains a read-protected file or a variable in `.env.forge.local` only.

Testnet checklist: [YOHUALLI_TESTNET_OPERATIVO.md](./YOHUALLI_TESTNET_OPERATIVO.md) · Aura + Yohualli: [docs/aura/README.md](./aura/README.md).

---

## Español (América Latina)

### Reglas

1. **Nunca** definas con el prefijo `VITE_` ni mnemónicas, ni *private key*, ni tokens. Vite expone `VITE_*` al *bundle* del *front*; con herramientas de desarrollo o un *build* quedan alcanzables.  
2. **Forge, relé y *scripts* en Node** (RPC, `PRIVATE_KEY`, `MNEMONIC`, *derive* *lab*): usa **`.env.forge.local`**, que no se sube a *git*, o el **toolbox** que inyecta el *env* al subproceso; no uses variables con prefijo `VITE_` para eso.  
3. Evita una sola línea reutilizable `export KEY=0x… && yarn run …` en el **historial** del *shell*; prefiere `yarn yoh:toolbox run <script>`.

### Archivos

| Archivo | Uso | ¿En git? |
|--------|-----|----------|
| [`.env.example`](../.env.example) | Plantilla solo con `VITE_*` y datos públicos | Sí |
| `.env.local` | Copia local: `cp .env.example` y ajusta | No |
| [`.env.forge.example`](../.env.forge.example) | Plantilla sin `VITE_` (RPC, claves) | Sí |
| `.env.forge.local` | Secretos; `chmod 600` en Unix | No |

### `yarn yoh:toolbox`

- **`init`** — crea `.env.local` y `.env.forge.local` a partir de las plantillas, si aún no existen.  
- **`check`** — qué archivos se cargan y nombres de claves; los secretos se resumen con un *hash*, no con el valor.  
- **`run <script>`** — fusiona ambos *env* (lo que ya exportaste en el *shell* pisa al archivo) y ejecuta `yarn run <script>`; por ejemplo `evm:forge:merkle`. Si dejaste `YOHUALLI_LAB_MNEMONIC` en `.env.forge.local`, `run lab:derive-evm-roles` no pasa la frase por *stdout* del *shell*.  
- **`derive-interactive`** — pide frase o ruta; lo más seguro sigue siendo un archivo con permisos mínimos o solo la variable en *forge* *local*.

*Testnet:* [YOHUALLI_TESTNET_OPERATIVO.md](./YOHUALLI_TESTNET_OPERATIVO.md) · *Aura* + Yohualli: [docs/aura/README.md](./aura/README.md).
