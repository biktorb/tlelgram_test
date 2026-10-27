# Game server + built client in one image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
RUN npm ci
COPY tsconfig.json ./
COPY packages packages
# Same-origin API: the client calls the server that served it.
ENV VITE_API_URL=/
RUN npm run build -w @otryad/client && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/node_modules node_modules
COPY packages/core packages/core
COPY packages/server packages/server
COPY --from=build /app/packages/client/dist packages/client/dist
ENV STATIC_DIR=/app/packages/client/dist PORT=3000
EXPOSE 3000
USER node
CMD ["node", "packages/server/src/main.ts"]
