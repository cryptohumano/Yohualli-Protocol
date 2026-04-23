# Dilema PoC: prover Honk (ECDSA) en la PWA y cierre con «bring your own infrastructure»

Este documento fija un **criterio de decisión** tras el trabajo de laboratorio con Noir, Barretenberg (`@aztec/bb.js` en WebAssembly) y el circuito [`yohualli_merkle_attest_v1`](../circuits/yohualli_merkle_attest_v1/src/main.nr) (v1: `verify_signature` de ECDSA secp256k1 + `merkle_root` pública). No sustituye el borrador amplio de protocolo en [Yohualli Protocol draft 1.1.md](Yohualli%20Protocol%20draft%201.1.md), pero **aterriza** un punto que allí solo se insinúa: dónde se *genera* la prueba en un despliegue realista.

### Aclaración: PoC en PWA (iOS / Android) y BYOI (no se excluyen)

En la **fase 0** se comprobó que un **corte del laboratorio** puede **generar pruebas** del circuito **dentro de la PWA** en dispositivos reales. Eso **sí** evita que, *de facto*, *todo* el mundo tenga que usar una máquina o un servicio externo para *poder* prover: un usuario con un dispositivo adecuado (memoria, tiempo) puede seguir haciéndolo **en cliente**.

Con lo que **sí** no se puede quedar aún un **producto** (ni un SLA *“funciona en toda gama móvil en pocos minutos”* para el circuito gordo) es fijar **solo** esa vía, sin *salidas* documentadas, porque en la práctica siguen existiendo:

- gama baja de hardware, *tabs* restringidas, y cierres de pestaña a mitad de *prove*;
- riesgo de *OOM* o tiempos inaceptables aun con el *patch* de *msgpack*;
- y evolución de `@aztec/bb.js` que obligue a revalidar *benchmarks*.

**BYOI** (*bring your own infrastructure*), `nargo`+`bb` en máquina, CI o nodo *helper*, no se propone como **sustituto lógico** de la PWA *para quien ya puede* probar en *browser*, sino como: (1) **cierre seguro** del *roadmap* del PoC mientras se refina *statement* y (2) **caminos opcionales** (operadores, *power users*, resiliencia) para quien *no* pueda o no deba *prover* en el *phone*. El dilema nombra dónde situar la **obligación operativa de referencia** del *verificador* y del *protocolo*, no niega el **hecho** de que se pueda *prover* en la PWA en condiciones reales de laboratorio o de dispositivo *capacitado*.

---

## 1. Qué se intentó

Validar, para el PoC, la hipótesis: **generar** pruebas UltraHonk en el **navegador** (PWA) con el mismo *pipeline* que en máquina de desarrollo: `@noir-lang/noir_js` + Barretenberg con `BackendType.Wasm` (hilo principal o Web Worker) y `keccak: true` para alinear con EVM.

El cuello no es un detalle de UX (Worker *vs* hilo principal: el Worker alivia bloqueo de la UI, no el coste cripto total) ni el array público de `merkle_root` (apenas añade constraints frente a ECDSA). El peso recae en la **ampliación en constraints** de `std::ecdsa_secp256k1::verify_signature` al compilar a ultra_honk, con serialización grande hacia el WASM, límites de buffers (p. ej. I/O msgpack con el runtime) y requisitos de memoria y tiempo poco acordes a un *prover* fiable en cliente para este circuito.

**Conclusión para *cierre* del PoC – calidad *producto* / *SLA*:** con el *stack* actual, **no** se fija la **obligación** de soportar *exclusivamente* *prover* fiable (tiempo + memoria acotables en toda la matriz de dispositivos) para *este* statement (ECDSA in-circuito + Honk) **únicamente** vía PWA, **sin** documentar otras vías. Eso no contradice el **hecho** de que en fase 0 haya *proofs* generados **en** la PWA (iOS, Android) — solo delimita **referencia** operativa *vs* “*nice-to-have* que hemos visto en laboratorio y podemos ofrecer como *modo* soberano a quien tenga *hardware* acorde”.

*Nota de laboratorio:* *Length is too large* (scratch msgpack) y presión de memoria: mitigables en parte; aun mitigado, un **MVP** sensato sigue pudiendo ofrecer **PWA = primer intento** de *prove* y, si falla o no aplica, **BYOI, relé o nodo** como *fallback* o cola, sin forzar a **todos** los usuarios a “traer *infra* propia” como única vía.

---

## 2. Cierre del PoC: *bring your own infrastructure* (BYOI)

Para **cerrar el PoC** y continuar con el hilo de protocolo sin bloquear el roadmap en prover en cliente:

- **Cierre del PoC en documento / CI:** *referencia* de *prove* = **máquina de dev** (`nargo` + `bb prove`), contenedor o CI, para *reproducir* y no depender de un *browser* en la tarea “compilar, auditar, desplegar *verificador*”.
- **Cierre del PoC en *usuario*:** quien *pueda* **no** está forzado a otra *infra*; la PWA **puede** ofrecer *prove* (como comprobó la fase 0) para quien no quiera o no necesite salir del dispositivo. BYOI añade **redundancia** (integradores, baja gama, o lotes) — no reemplaza por lógica la **soberanía** en *device* *allí donde* el *prove* *en* cliente *sea aceptable*.
- **Siempre** la PWA aporta: **cartera**, atestación, **verificación** on-chain (`readContract` al *verifier* / *registry*), y coordinación con relés, con *prove* en *browser* como *capa* a **madurar** a SLA de producto, no como mito a negar.

Esto no diluye el objetivo de *descentralización operativa* de largo plazo: **distribuís el despliegue** del prover, no obligáis a un único SaaS, y la composición *cliente + relé + caden* sigue descrita en la documentación de arquitectura; solo fijáis dónde cae, **hoy**, el coste del prover para v1 *tal como está modelado*.

---

## 3. Después del PoC: diseño de *statements* y de circuito

En [Yohualli Protocol draft 1.1](Yohualli%20Protocol%20draft%201.1.md) y *papers* alineados se cruzan Merkle, identidad y ZK, a menudo **a alto nivel** o con poco detalle dónde se *genera* la prueba (Merkle con *paths*, *nullifiers*, múltiples cortes de circuito). Hasta ahora, el *repo* fijó un corte mínimo operativo: **EIP-712 → digest → `verify_signature` in-circuito** + *binding* a `merkle_root` en públicos, sin aún *path* de Merkle dentro del circuito (ver [YOHUALLI_MERKLE_PROOF_V0.md](YOHUALLI_MERKLE_PROOF_V0.md)).

Tras el PoC, el **siguiente piso** es bajar a **diseño cripto de producto**, no solo de implementación: qué *statement* debe demostrar cada *release* de circuito, qué se prueba *en* la prueba, qué se fija *fuera* (canal, relé, on-chain) y bajo qué enemigos. Suelen existir *trade-offs* deliberados, por ejemplo:

- menores circuitos (p. ej. *sin* ECDSA in-circuit; identidad fijada por otra vía) *vs* prueba unificada *«esto firmé esto»*;
- *paths* y hash en Noir congelados, nueva VK, nuevo despliegue de `HonkVerifier` y lineamiento de públicos, como ya describe el repositorio para *upgrades* v1 / v2.

Ese trabajo es **anterior o paralelo** a afinar el prover; no depende aún de *bb* en el *browser*.

---

## 4. Vía de trabajo acordada en dev: `nargo` + `bb` y compilar en máquina de dev

Alineado con [CIRCUITS_LAB.md](CIRCUITS_LAB.md) y con los *scripts* `npm run circuit:*` del repositorio:

1. Escribir o ajustar Noir bajo `circuits/`, acorde al *statement* que se congela.
2. **`nargo compile`** (y, si aplica, `nargo execute` con *witness* de lab).
3. **`bb prove`** (y, para EVM, *flags* y artefactos que el repo y los scripts documentan) y, cuando toque, **`bb write_solidity_verifier`** y sincronización hacia `evm/yohualli_honk_verifier/`.
4. PWA: verificación, integración, muestras embebidas, **no** *prover* de referencia del circuito gordo mientras el diseño no fije explícitamente un *prover* *ligero* en *browser* (si aplica más adelante con otro *statement* o con evolución de *bb*).

Esa cadena mantiene la **misma** disciplina de ingeniería que un PoC que ya validó aceptación, verificador y registro, con la clara separación: **probar en dev / infra, verificar y usar en PWA y cadena**.

---

## 5. Referencias en el repositorio

| Recurso | Uso |
|---------|-----|
| [CIRCUITS_LAB.md](CIRCUITS_LAB.md) | Código, artefactos, scripts, límites del *lab* y *patch* *msgpack* / postinstall. |
| [YOHUALLI_MERKLE_PROOF_V0.md](YOHUALLI_MERKLE_PROOF_V0.md) | *Loop* *epoch* + *root* on-chain, qué *no* prueba aún v1 en *paths*. |
| [YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md](YOHUALLI_CIRCUIT_MERKLE_INCLUSION_V2.md) | *Siguiente* corte hacia Merkle con *paths* (diseño). |
| `scripts/patch-aztec-bb-msgpack-scratch.mjs` | Postinstall: aumento del scratch I/O a `bb` en *node_modules*; *no* reembolsa viabilidad de *prover* completo de ECDSA en cliente. |
| [Yohualli Protocol draft 1.1.md](Yohualli%20Protocol%20draft%201.1.md) | Línea maestra; no reemplaza este criterio. El borrador roza aún, de lejos, dónde y cómo vive el prover en un despliegue concreto; **aquí** se fija, para el PoC, dónde **no** poner hoy el prover de v1 (PWA *solo* con *bb*). |

---

Decisión *PoC* (BYOI + *nargo* / *bb* en dev) acotada a lo que acompaña a este repositorio en el momento de escribir este archivo.
