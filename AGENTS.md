# AGENTS.md

## Monorepo

Bun workspaces (`workspaces: ["packages/*"]`). Packages:
- `packages/backend` — Elysia API (`src/main.ts`), Drizzle + PGlite/Neon, better-auth. Workspace name `@bun-boilerplate/backend`.
- `packages/web` — TanStack Start (SSR) + Vite + Nitro + Tailwind + shadcn/Base UI. Workspace name `@bun-boilerplate/web`.
- `packages/i18n` — Shared i18n lib (`@bun-boilerplate/i18n`).

Use `bun` (not npm/pnpm). Root `bun.lock` is source of truth; `package-lock.json` is stale.

## Commands

```bash
bun run build              # bun run --filter '*' build
bun run dev                # --filter '*' dev (backend: bun src/main.ts, web: bun --bun vite dev :3000 via Nitro)
bun run test               # vitest run (all projects)
bun run test:watch         # vitest
bun run test:coverage      # vitest run --coverage (v8, text+html+lcov)
bun run lint               # oxlint . --type-aware
bun run lint:fix           # oxlint . --type-aware --fix
bun run format             # oxfmt .
bun run format:check       # oxfmt . --check
```

Per-package (from package dir):
- `packages/backend`: `bun --bun vitest run` (unit), `bun --bun vitest run --config vitest.e2e.config.ts` (e2e); `bun run db:generate|db:migrate|db:push|db:studio` (drizzle-kit, schema `src/modules/**/*.table.ts`, out `migrations/`)
- `packages/web`: `bun run generate-routes` (tsr generate, output `src/routeTree.gen.ts` — do not hand-edit), `bun run typecheck` (clean; web `src/i18next.d.ts` must merge backend `src/locales/en.json` keys because eden's `import type { App }` pulls backend templates into the web program), `bun run build` (`bun --bun vite build`), `bun run package` (build + `bun build --compile` standalone exe at `dist/web.exe`; requires nitro options `serveStatic:"inline"`, `noExternals`, `inlineDynamicImports` in `vite.config.ts` so `.output/server/index.mjs` is self-contained — public assets inline as base64, no `--asset` needed); all web scripts run on Bun (vite, vitest, nitro preset `bun`)
- `packages/i18n`: `bun run test`

Run single test: `bun --bun vitest run src/path/file.test.ts` or `vitest run --project=backend|web|i18n -t "test name"`. E2E is isolated: `vitest.e2e.config.ts` forces `sequence.concurrent:false`, `fileParallelism:false`, 30s timeouts — keep it.

## Config & Env

- `packages/backend/src/common/config.ts` is single source of truth (Zod `configSchema`). Env is loaded via `secret.ts` → Infisical SDK (`INFISICAL_CLIENT_ID/SECRET/PROJECT_ID` + `NODE_ENV`) plus `process.loadEnvFile(.env)`. Do not read `.env` files directly; use `config` object. Required groups: `app` (port, origins, baseURL), `auth` (BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET), `database` (DATABASE_URL), `email` (RESEND_API_KEY `re_*`), `s3` (S3_*), `sentry` (SENTRY_DSN). `drizzle.config.ts` reads `config.database.url`.
- `packages/web` dev needs `dotenv -e .env.local -- bun --bun vite dev --port 3000` (see `packages/web/package.json:dev`). Sentry instrumented via `src/instrument.ts` (backend pattern: imported first in `src/server.ts`, reads `process.env.VITE_SENTRY_DSN` at runtime — do not use `import.meta.env` there, it gets inlined at build). Prod: nitro bun preset, run with `bun .output/server/index.mjs`.

## Typecheck / Lint / Format

- TS `module: nodenext`, `target: esnext`, strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. `skipLibCheck:true`.
- `oxlint.config.ts` is type-aware (`typeAware:true`, LSP `npx oxlint --lsp`). Plugins: typescript, react, jsx-a11y, vitest, node + custom `tools/oxlint/anti-slop/index.ts`. Notable rules: `anti-slop/*`, `no-restricted-imports: ban node:*` (use bare `fs` not `node:fs`), `typescript/explicit-member-accessibility`, `consistent-type-definitions: interface`. Overrides relax `anti-slop/no-runtime-typeof` and a11y in `packages/web/src/components/ui/**` (vendored shadcn) and `react/only-export-components` in routes.
- `oxfmt` (not Prettier): `printWidth 120`, `tabWidth 2`, `semi false`, `singleQuote false`, `sortImports true`.
- Lint discipline: Never disable lint via comment (`eslint-disable`, `oxlint-disable`, `@ts-ignore`, `@ts-expect-error`, `biome-ignore`, etc.) and never edit `oxlint.config.ts`, `oxfmt`, or any lint/type config without explicit user approval. If a rule feels wrong, ask the user directly — do not silently suppress or reconfigure.

## Testing Conventions

- Root `vitest.config.ts` uses `projects: ["packages/*"]`; each package merges `vitest.base.ts` (`globals:true`, `environment:node`, `include: src/**/*.{test,spec}.{ts,tsx}`). `packages/web` overrides to `jsdom` + vite react plugin.
- Coverage excludes `**/*.d.ts`, `**/*.{test,spec}.{ts,tsx}`.
- Backend `src/main.ts` guards `app.listen` with `import.meta.main && config.app.environment !== "test"` — import `app` in tests without side-effects.
- E2E helpers in `packages/backend/test/helpers/`, specs `*.e2e.ts` under `packages/backend/test/`.
- Mocking: `anti-slop/no-module-mocking` (`oxlint.config.ts:32`) bans `vi.mock`/`vi.doMock`/`vi.unstable_mockModule` (and `jest` equivalent). Do not mock modules or over-mock functions. Replace dependencies through real seams — constructor params, function args, service interfaces, or faithful test doubles. Mock only at the seam for external boundaries (DB, HTTP, email, time, `config`) via injection, never whole-module mocks.

## Architecture Notes

- Backend entry `packages/backend/src/main.ts:15` — Elysia + `@sentry/elysia` + `openapi` (dev only at `/api`) + `cors` + `errorPlugin` + `localePlugin`; routes grouped under `/api` (`authPlugin`, `articlePlugin`). Add modules under `src/modules/<name>/` with `*.table.ts` for Drizzle.
- Web: `vite.config.ts` order matters — `devtools()` → `nitro({ rollupConfig:{external:[/^@sentry\//]}})` → `tailwindcss()` → `tanstackStart()` → `viteReact()` → `babel(reactCompilerPreset)`. `tsr.config.json` + `tsconfig.json` path aliases drive route generation.
- Infra: `opencode.json` wires oxlint LSP (type-aware) and Infisical MCP (`bun x @infisical/mcp`). No CI workflows / Husky hooks checked in.

## Agent Skills

### Issue tracker

Issues in GitHub Issues (ToufiqSenpai/bun-boilerplate) via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`. Use `CONTEXT.md` terms verbatim (User/Account/Session/Verification/Role; Article/ArticleCategory/ArticleTranslation/ArticleCategoryTranslation/Status/Slug/Locale).

## Git Workflow — implement must use branch + PR

When invoking `/implement` (or implementing any ticket/issue):

1. Before code: `git fetch origin` and ensure working tree clean (`git status`), then `git switch main && git pull` and `git switch -c feat/<issue-number>-<slug>` (e.g. `feat/11-backend-verification-gate`). If branch exists, `git switch` to it.
2. Do the work via `/tdd` at the pre-agreed seams, committing in small steps to **that branch** only. Never commit directly to `main`.
3. After `/code-review` passes: `git push -u origin HEAD` then `gh pr create --title "<issue>: <title>" --body "Fixes #<number>" --base main`. Keep `ready-for-agent` on the issue; PR gets review label.
