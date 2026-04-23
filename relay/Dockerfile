# El contexto de build debe ser la RAÍZ del monorepo (Railway por defecto, o: docker build -f relay/Dockerfile -t yohualli-relay .)
FROM node:22-alpine
WORKDIR /app
COPY relay/package.json relay/package-lock.json ./
RUN npm ci --omit=dev
COPY relay/index.mjs ./
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "index.mjs"]
