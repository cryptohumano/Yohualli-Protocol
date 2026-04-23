# Contexto = carpeta relay/ (p. ej. `docker build -f Dockerfile .` desde `relay/`, o Railway con **Root = relay**).
# Si el build usa la raíz del monorepo, usá en su lugar `../Dockerfile.relay` (raíz del repo).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.mjs ./
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "index.mjs"]
