# Builds the static presentations and serves them with nginx.
#   docker compose up --build   → http://localhost:8080/ (Beget · Атлас)

FROM node:24-slim AS build
# Chromium prints the PDFs; it stays in this stage only.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium \
 && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Build, print both PDFs from the fresh build, then copy them into dist.
RUN npm run build:release

FROM nginx:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
