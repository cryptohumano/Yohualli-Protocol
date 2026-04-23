# Tier-SybilRank en laboratorio: base matemática

Este documento describe el algoritmo **`computeTierSybilRank`** implementado en [`sybilRankTiers.ts`](../src/social-graph/sybilRankTiers.ts), usado en la PWA para colorear / ponderar nodos en el **vecindario** (vista de fuerza y metadatos tier-Sybil). Es una **variante de PageRank personalizado** sobre un grafo dirigido deducido de atestaciones off-chain.

No debe confundirse con el **Private SybilRank** completo del borrador de protocolo (`Yohualli Protocol draft 1.1.md`, §4.1 en adelante): allí aparecen conductancia de cortes, VRF, pruebas Noir sobre commitments, etc. **Eso no está implementado** en este cálculo local.

---

## 1. Conjunto de nodos

Sea \(A\) el conjunto finito de atestaciones consideradas (p. ej. aristas del vecindario BFS). El conjunto de nodos es

\[
V = \bigcup_{a \in A} \{\,\texttt{attesterAddress}(a),\, \texttt{subjectAddress}(a)\,\}.
\]

---

## 2. Pesos de aristas dirigidas (atestador \(\to\) sujeto)

Cada atestación \(a\) define una arista del atestador \(u\) al sujeto \(v\). Se **agregan** todas las atestaciones con el mismo par \((u,v)\) en un solo peso.

### 2.1. Frescura \(\phi(a)\)

Con `nowMs` de referencia y `timestampMs` de la atestación, la edad en días es \(\text{ageDays} = (nowMs - timestampMs) / (86\,400\,000)\).

\[
\phi(a) = \max\left(0,\; 1 - \frac{\text{ageDays}}{180}\right).
\]

Es decir, decaimiento lineal hasta cero a los **180 días** (media vida de frescura en el código; constante `FRESH_HALF_LIFE_DAYS` en [`graphVisualization.ts`](../src/social-graph/graphVisualization.ts), función [`attestationFreshness`](../src/social-graph/graphVisualization.ts#L4-L10)).

### 2.2. Peso por atestación y agregación

Para la atestación \(a\) de tier \(\tau_a\):

\[
\tilde w(a) = \phi(a)\cdot(0.15 + 0.12\,\tau_a).
\]

La implementación usa la misma \(\phi\) vía `attestationFreshness` y arma \(w_{uv}\) en [`sybilRankTiers.ts`](../src/social-graph/sybilRankTiers.ts) (agregación por par atestador \(\to\) sujeto).

Para cada par ordenado \((u,v)\):

\[
w_{uv} = \sum_{\substack{a \in A\\ \texttt{attester}(a)=u,\;\texttt{subject}(a)=v}} \tilde w(a).
\]

Solo se conservan aristas con \(w_{uv} > 0\). La fuerza de salida de \(u\) es

\[
s_u = \sum_{v:(u,v)\in E} w_{uv}.
\]

---

## 3. Matriz de transición (caminata aleatoria)

Se define una cadena de Markov **sobre aristas salientes del atestador**:

\[
P_{uv} =
\begin{cases}
\dfrac{w_{uv}}{s_u} & \text{si } s_u > 0,\\[0.8em]
\text{(manejado aparte; véase §5)} & \text{si } s_u = 0.
\end{cases}
\]

Interpretación: una unidad de “reputación” en el nodo \(u\) se reparte entre sus sujetos atestados **en proporción a** \(w_{uv}\).

---

## 4. Vector de teleportación (semillas) \(\mathbf{v}\)

El término \(\alpha\,\mathbf{v}\) en la iteración (§6) fija **a dónde vuelve** una fracción \(\alpha\) de la masa en cada paso (teleportación tipo PageRank).

### 4.1. Semillas implícitas por tier emitido

Para cada nodo \(i \in V\), sea \(T_i\) el **máximo** `trustTier` con el que \(i\) aparece como **atestador** en \(A\) (si nunca atestó, \(T_i = 0\)).

Se elige un umbral entero \(\theta\) empezando en `implicitSeedTierMin` (por defecto **7**) y bajando de uno en uno hasta que exista al menos un nodo con \(T_i \ge \theta\). Los nodos que cumplen eso forman el conjunto de **semillas por tier**; el umbral usado se devuelve como `implicitSeedTierThresholdUsed`.

### 4.2. Masa sobre semillas por tier

Primero se asigna peso proporcional a \(T_s + 1\) a cada semilla por tier \(s\), y se **normaliza** a suma 1 sobre \(V\) (los demás nodos reciben 0 en esta fase).

### 4.3. Trusted seeds de laboratorio

Si hay identidades **trusted** presentes en el subgrafo ([`trustedSeedsLab.ts`](../src/social-graph/trustedSeedsLab.ts) + env `VITE_LAB_TRUSTED_*`), sea \(f \in [0,1]\) la fracción `trustedSeedMassFraction` (por defecto **0.65**): una porción \(f\) de la masa total se reparte **uniformemente** entre esos nodos trusted en \(V\). El resto \(1-f\) se reparte entre las semillas por tier (excluyendo trusted de la parte tier si es posible), de nuevo con pesos \(\propto T_s+1\), y se renormaliza a 1 sobre \(V\).

### 4.4. Boost del centro del vecindario

Opcionalmente se suma `boostExtraMass` (por defecto **0.12**) repartida por igual entre `boostSeedNodeIds` (p. ej. el centro del BFS), y se **vuelve a normalizar** el vector a suma 1.

El resultado es \(\mathbf{v}\) con \(v_i \ge 0\) y \(\sum_{i\in V} v_i = 1\).

---

## 5. Nodos sin salida (“dead ends”)

Si \(s_u = 0\) pero el nodo \(u\) tiene masa \(r_u > 0\) en la iteración, la contribución \((1-\alpha)\,r_u\) que **no** puede salir por aristas se reparte **uniformemente** entre `leakTargets`: si hay trusted en el grafo, ellos; si no, las semillas implícitas por tier; si tampoco, **todos** los nodos \(V\).

Así se evita perder masa y se mantiene el vector de probabilidad bien definido tras la renormalización global.

---

## 6. Iteración en potencias (damping)

Parámetros por defecto:

- \(\alpha =\) `dampingAlpha` \(= 0.18\).
- Número de iteraciones \(K =\) `powerIterations` \(= 48\).

Inicialización: \(\mathbf{r}^{(0)}\) se toma igual a \(\mathbf{v}\) y se normaliza a suma 1 sobre \(V\).

Para \(k = 0,\dots,K-1\) (bucle en [`computeTierSybilRank`](../src/social-graph/sybilRankTiers.ts)):

1. Poner \(\mathbf{r}^{(k+1)} := \alpha\,\mathbf{v}\).
2. Para cada \(u \in V\), con masa actual \(r_u^{(k)}\):
   - si \(s_u > 0\): para cada arista \((u,v)\), sumar \((1-\alpha)\, r_u^{(k)}\, \dfrac{w_{uv}}{s_u}\) a \(r_v^{(k+1)}\);
   - si \(s_u = 0\) y \(r_u^{(k)}>0\): repartir \((1-\alpha)\, r_u^{(k)}\) uniformemente entre `leakTargets` (§5).
3. Sustituir \(\mathbf{r}^{(k)} \leftarrow \mathbf{r}^{(k+1)}\) y **renormalizar** \(\mathbf{r}^{(k)}\) para que \(\sum_{i\in V} r_i^{(k)} = 1\).

En forma compacta (ignorando dead ends por un momento):

\[
\mathbf{r}^{(k+1)} \;\propto\; \alpha\,\mathbf{v} + (1-\alpha)\,\mathbf{P}^{\top} \mathbf{r}^{(k)},
\]

donde \(\mathbf{P}\) tiene entradas \(P_{uv}\). Es el mismo núcleo que **PageRank personalizado** con vector de preferencia \(\mathbf{v}\) y factor de amortiguación \((1-\alpha)\) sobre la caminata. La renormalización explícita tras cada paso es una elección de implementación numérica (equivale a trabajar sobre distribuciones de probabilidad en \(V\) en cada \(k\)).

---

## 7. Salida hacia la UI

- **`rawScores`**: valores finales \(r_i^{(K)}\) (ya normalizados, suman 1).
- **`scores01`**: \(s_i = r_i^{(K)} / \max_{j\in V} r_j^{(K)}\) si el máximo es positivo; si no, distribución uniforme.

Así cada nodo recibe un valor en \([0,1]\) relativo al máximo del subgrafo, útil para coloración en [`SocialGraphForceView.tsx`](../src/social-graph/SocialGraphForceView.tsx) (propiedad `sybilRank01`) y en [`buildGraphVizData`](../src/social-graph/graphVisualization.ts#L53-L113) (mezcla `sybilRank01` en `val` del nodo y peso de arista con frescura × tier para el layout).

---

## 8. Tabla de parámetros por defecto (`DEFAULT_OPTS`)

| Parámetro | Valor | Rol |
|-----------|-------|-----|
| `implicitSeedTierMin` | 7 | Cota inicial al buscar semillas por tier máximo emitido. |
| `dampingAlpha` \(\alpha\) | 0.18 | Fracción de teleport a \(\mathbf{v}\) por iteración. |
| `powerIterations` \(K\) | 48 | Pasos de potencia. |
| `boostExtraMass` | 0.12 | Masa extra al centro (luego renorm.). |
| `trustedSeedMassFraction` \(f\) | 0.65 | Parte de \(\mathbf{v}\) en trusted de lab vs tier. |

Todos pueden sobreescribirse vía `TierSybilRankOptions` pasado a [`getNeighborhoodWithTierSybil`](../src/social-graph/socialGraphService.ts) (los valores por defecto del documento están en `DEFAULT_OPTS` dentro de [`sybilRankTiers.ts`](../src/social-graph/sybilRankTiers.ts#L43-L49)). La página de laboratorio que invoca el cálculo del vecindario está en [`Attestations.tsx`](../src/pages/Attestations.tsx) (`getNeighborhoodWithTierSybil` y `buildGraphVizData`).

---

## 9. Relación con el protocolo Yohualli (borrador)

| Aspecto | Borrador §4.x (objetivo) | `computeTierSybilRank` (lab actual) |
|--------|-------------------------|-------------------------------------|
| Semillas | Registrars / Council on-chain | Tier emitido + trusted de lab + boost |
| Peso de aristas | TS del emisor, distancia, frescura | Frescura lineal + tier lineal en \(\tilde w\) |
| Anti-islas | Conductancia \(\phi(C)\), penalización | No implementado |
| ZK | Noir verifica umbral sobre commitments | No involucrado en este cálculo |

---

## 10. Referencias de código

| Concepto | Archivo (enlace al repositorio) |
|----------|----------------------------------|
| Algoritmo principal: \(\tilde w\), \(P_{uv}\), \(\mathbf{v}\), dead ends, potencias, `rawScores` / `scores01` | [`src/social-graph/sybilRankTiers.ts`](../src/social-graph/sybilRankTiers.ts) (`computeTierSybilRank`, `DEFAULT_OPTS`) |
| Frescura \(\phi(a)\), constante 180 días | [`src/social-graph/graphVisualization.ts`](../src/social-graph/graphVisualization.ts) (`FRESH_HALF_LIFE_DAYS`, `attestationFreshness`) |
| Vecindario BFS + invocación del ranking | [`src/social-graph/socialGraphService.ts`](../src/social-graph/socialGraphService.ts) (`getNeighborhoodWithTierSybil`) |
| Trusted seeds de laboratorio y env | [`src/social-graph/trustedSeedsLab.ts`](../src/social-graph/trustedSeedsLab.ts) |
| Tipo de nodo con `sybilRank01` | [`src/social-graph/types/graph.ts`](../src/social-graph/types/graph.ts) (`GraphVizNode`) |
| Color / tooltip con Tier-SybilRank | [`src/social-graph/SocialGraphForceView.tsx`](../src/social-graph/SocialGraphForceView.tsx) |
| Peso visual de arista (frescura × tier) y fusión con `scores01` | [`src/social-graph/graphVisualization.ts`](../src/social-graph/graphVisualization.ts#L53-L113) (`buildGraphVizData`) |
| UI lab (calcular vecindario, metadatos del umbral) | [`src/pages/Attestations.tsx`](../src/pages/Attestations.tsx) |

Para el relay y el gossip (canal distinto al ranking), véase [`yohualli-gossip-relay-lab.md`](./yohualli-gossip-relay-lab.md).

> En GitHub/GitLab, los enlaces `../src/...` abren el archivo en la rama actual del navegador. En visores locales de Markdown, ábralos desde la raíz del repo si el clic no resuelve la ruta.
