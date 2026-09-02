# syntax=docker/dockerfile:1
# Build context MUST be the repo root: docker build -f packages/web/Dockerfile .

# ---- build: vite build + bun compile to standalone binary (same Bun version as local dev) ----
FROM oven/bun:1.4.0-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/web/package.json packages/web/
COPY packages/backend/package.json packages/backend/
COPY packages/i18n/package.json packages/i18n/
RUN bun install --frozen-lockfile

# vite resolves workspace sources: web + i18n code (backend is import-type-only, erased at build)
COPY tsconfig.json ./
COPY packages/i18n/src packages/i18n/src
COPY packages/i18n/tsconfig.json packages/i18n/
COPY packages/web/tsconfig.json packages/web/vite.config.ts packages/web/tsr.config.json packages/web/components.json packages/web/
COPY packages/web/src packages/web/src
COPY packages/web/scripts packages/web/scripts

# NODE_ENV is read at runtime for Sentry config; VITE_SENTRY_DSN comes from the runtime env, never baked in
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# import.meta.env is inlined by vite at build time — this is the public backend URL the browser calls
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL

# serveStatic:"inline" embeds public/ into the server bundle, so no --asset step is needed
RUN cd packages/web && bun run package

# ---- runtime: only the self-contained binary + musl/stdc libs ----
FROM alpine:3.22
RUN apk add --no-cache libstdc++ libgcc \
    && adduser -D -H -u 10001 app

COPY --from=build /app/packages/web/dist/web /usr/local/bin/web

USER app
ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000

ENTRYPOINT ["web"]
