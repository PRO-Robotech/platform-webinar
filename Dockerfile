# Builds the static presentations and serves them with nginx.
#   docker compose up --build   → http://localhost:8080/ (Beget · Атлас)

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# The PDFs are committed in outputs/ and copied into dist by the build;
# re-export them locally with npm run export:pdf (needs Chrome).
RUN npm run build

FROM nginx:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
