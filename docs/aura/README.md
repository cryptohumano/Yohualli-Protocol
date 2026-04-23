# Aura (wallet) y su relación con Yohualli

Este repositorio (**Yohualli-Protocol**) es un **monorepo de fase 0** centrado en **atestaciones EIP-712**, **circuitos Noir (Honk)**, **PVM/EVM**, **P2P** y **verificación** de **personalidad digital** *off-chain* con *settlement* *on-chain*. La base de *wallet* (Substrate, *keyring* **sr25519**, WebAuthn, *multi-chain*) proviene de un *fork* evolutivo del **Aura Wallet**.

## Repositorio original: Aura

- Código, ramas (p. ej. *andino*) e historial del **proyecto Aura (PWA Polkadot)**: [cryptohumano/aura-pwa](https://github.com/cryptohumano/aura-pwa)  
- Descripción en GitHub: herramientas criptográficas *cliente*, *dedot*, *Polkadot* API; identidad y cuentas.

## Por qué no es una *rama* del mismo repo

Mantener **Yohualli** y **Aura** en **ramas duales** del *mismo* repositorio mezcla *releases*, CI, documentación y *issues* de dos *producto-narrativas* distintas. Lo habitual es: **repositorio de protocolo** (este) + **repositorio de billetera** (Aura) enlazados por *documentación* y, si aplica, *dependencias* o *submódulo* a futuro. Nada impide *cherry-pick* o *sync* puntuales entre repos, pero **un solo default branch** no debe *alternar* entre *wallet genérica* y *protocolo ZK*.

## Cómo encaja la capa “institucional” *vs* *personalidad* privada

- **Substrate + People Chain (cuando aplica en Aura)** — identidad pública, curación o *registrars* en el ecosistema; **sr25519** para firmas y cuentas nativas.  
- **Yohualli** — *statement* cripto orientado a **secp256k1** hacia *contratos* (EIP-712, `HonkVerifier`, *nullifiers* / *Merkle* según *doc*), y **pruebas de bajo dato** para **participar sin colgar el grafo** en *chain*.

Esa **complementariedad** (legítimo *on-chain* *vs* *personality proof* *privada*) se describe en [Yohualli Protocol draft 1.1.md](../Yohualli%20Protocol%20draft%201.1.md) (introducción y *People / Registrars*). Cualquiera que quiera *iterar* sobre *Aura* para *features* puntuales y cruzar con el protocolo puede *clonar* *aura-pwa* y *este* repositorio por separado.

Documentación Aura retirada de *este* *árbol* y dónde buscarla: [ARCHIVE.md](./ARCHIVE.md).
