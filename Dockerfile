# syntax = docker/dockerfile:1

# Proofroom server: Node 24 running TypeScript source directly (no build
# step — see docs/decisions/0001-stack.md), node:sqlite for durable storage
# on the /data volume (fly.toml), node:http for HTTP. One runtime dependency
# (marked, for rendering README.md at /readme/).

FROM docker.io/library/node:24.21.0-alpine

WORKDIR /app

# Install only production dependencies from the frozen lockfile.
COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@11.9.0 --activate \
    && pnpm install --prod --frozen-lockfile

COPY src/ ./src/
COPY README.md ./

ENV PORT=8080
ENV DATA_DIR=/data
EXPOSE 8080

CMD ["node", "src/server.ts"]
