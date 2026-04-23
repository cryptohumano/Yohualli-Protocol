# Contexto de build = SOLO la carpeta relay/ (p. ej. Railway con Root directory = "relay" o: cd relay && docker build -t yohualli-relay .)
# Si el contexto es la raíz del monorepo, usá en la raíz: Dockerfile.relay
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.mjs ./
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "index.mjs"]
