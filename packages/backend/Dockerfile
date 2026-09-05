# syntax=docker/dockerfile:1
# Build context MUST be the repo root: docker build -f packages/backend/Dockerfile .

# ---- build: compile to standalone binary with the same Bun version as local dev ----
FROM oven/bun:1.4.0-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/backend/package.json packages/backend/
COPY packages/i18n/package.json packages/i18n/
RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/backend/tsconfig.json packages/backend/tsconfig.build.json packages/backend/
# root tsconfig: tsconfig.build.json extends it — without it tsc loses skipLibCheck and fails (TS5083)
COPY tsconfig.json ./
COPY packages/i18n packages/i18n
COPY packages/backend/src packages/backend/src
COPY packages/backend/migrations packages/backend/migrations

# NODE_ENV is inlined into the binary at build time by bun build --compile
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# no --asset ./.env here: secrets are provided via runtime env, never baked into the image.
# the package build script still stats ./.env as an asset — satisfy it with an empty file
RUN touch packages/backend/.env
RUN cd packages/backend && bun run build

# ---- runtime: only the self-contained binary + musl/stdc libs ----
FROM alpine:3.22
RUN apk add --no-cache libstdc++ libgcc \
    && adduser -D -H -u 10001 app

COPY --from=build /app/packages/backend/dist/app /usr/local/bin/app

USER app
ENV NODE_ENV=production \
    PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health/ready || exit 1

ENTRYPOINT ["app"]
