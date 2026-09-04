# AGENTS.md — packages/web

Scope: `@bun-boilerplate/web` (TanStack Start + Vite + Nitro + Tailwind + shadcn/Base UI). Root `AGENTS.md` still applies; this file adds web-only rules.

## Commands (run from `packages/web`)

```bash
bun run dev              # dotenv -e .env.local -- bun --bun vite dev --port 3000
bun run generate-routes  # tsr generate -> src/routeTree.gen.ts (do not hand-edit)
bun run typecheck        # tsc --noEmit
bun run build            # bun --bun vite build
bun run package          # build + standalone exe at dist/web.exe
bun run test             # bun --bun vitest run (jsdom)
```

Single test: `bun --bun vitest run src/path/file.test.ts`.

## Architecture Notes

- Routes live in `src/routes/`; generated tree is `src/routeTree.gen.ts` — never hand-edit, run `generate-routes`.
- Shared UI in `src/components/ui/**` is vendored shadcn — relaxed a11y / `anti-slop/no-runtime-typeof` overrides apply there (see root `oxlint.config.ts`). Do not "fix" vendored patterns.
- `vite.config.ts` plugin order matters: `devtools()` → `nitro(...)` → `tailwindcss()` → `tanstackStart()` → `viteReact()` → `babel(reactCompilerPreset)`. Keep `nitro` options `serveStatic: "inline"`, `noExternals`, `inlineDynamicImports` so `.output/server/index.mjs` stays self-contained.
- Sentry: `src/instrument.ts` is imported first in `src/server.ts` and must read `process.env.VITE_SENTRY_DSN` at runtime — do not use `import.meta.env` there.
- i18n: `src/i18n.ts` wires `@bun-boilerplate/i18n` + `react-i18next` with `src/locales/en.json` and `src/locales/id.json`. `src/i18next.d.ts` must merge web `en.json` keys with backend `src/locales/en.json` keys because eden's `import type { App }` pulls backend templates into the web program.

## Testing Conventions

- `vitest.config.ts` uses `jsdom` + `@vitejs/plugin-react`. Test with `@testing-library/react` (`render`, `screen`, `fireEvent`).
- Follow root mocking discipline: no `vi.mock` / `vi.doMock`. Inject seams via props (e.g. `onSignIn`) instead of mocking modules.
- Prefer behavior assertions (roles, labels, alert text) over snapshots or implementation details.

### Locale Rule for Component Tests

- Do not create component tests for different locales. Use only one locale: `en`.
- Do not parametrize component tests over locales (e.g. `test.each(["en", "id"])`), do not switch `i18n.changeLanguage` per test, and do not duplicate assertions against `id.json` strings.
- Assert rendered copy against `en.json` values only (e.g. `"Admin Login"`, `"Sign in"`, `"Enter a valid email address"`).
- Locale switching, translation completeness, and fallback behavior belong to the `@bun-boilerplate/i18n` package tests — not to web component tests.
