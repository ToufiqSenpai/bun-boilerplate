# Research #33: better-auth admin API surface (minus impersonate)

Source: issue #33 (part of map #32). better-auth `1.7.1` (`packages/backend/package.json:36`, `bun.lock:1035`).
Admin plugin source of truth: `node_modules/better-auth/dist/plugins/admin/routes.mjs`.

Mount point: `packages/backend/src/main.ts:87` groups `authPlugin` under `/api`; `packages/backend/src/modules/auth/index.ts:210` does `.mount(auth.handler)` → full admin paths are `/api/auth/admin/*`.

Local Role matrix (`permissions.ts:15-25`, `index.ts:148` `admin({ ac, roles })`):
- `superadmin` = full `adminAc.statements` + `articleCategory` → holds ALL user/session admin permissions.
- `admin` = `{ user: [], session: [] }` → ZERO admin user/session permissions; every endpoint below 403s for `admin`. Only `superadmin` can use them.
- Role is a comma-joined string (`routes.mjs:22-24`); `setRole`/`createUser` reject unknown roles.
- Displayable User fields (`tables/auth.table.ts:5-15`): `id, name, email, emailVerified, image, role, banned, banReason, banExpires` + `createdAt/updatedAt`. Sessions (`:17-31`): `id, expiresAt, token, ipAddress, userAgent, userId, impersonatedBy`.

## Endpoint table (all require session via adminMiddleware → 401 if none)

| Method + path (under `/api/auth`) | Params | Response | Required permission |
|---|---|---|---|
| `GET /admin/list-users` (`routes.mjs:324`) | Query: `searchValue?`, `searchField?: email\|name` (default `email`), `searchOperator?: contains\|starts_with\|ends_with` (default `contains`), `limit?`, `offset?`, `sortBy?`, `sortDirection?: asc\|desc`, `filterField?` (default `email`), `filterValue?`, `filterOperator?: eq,ne,gt,gte,lt,lte,in,not_in,contains,starts_with,ends_with` (default `eq`) | `{ users, total, limit?, offset? }`; on DB error `{ users: [], total: 0 }`. No server-side default limit | `user:list` |
| `GET /admin/get-user?id=` (`:81`) | `id` required | `User` directly (unwrapped) | `user:get` |
| `POST /admin/create-user` (`:134`) | `email` (unique, lowercased), `name`, `password?`, `role?`, `data?` | `{ user }` | `user:create` (+ `user:set-role` if role, + `user:ban` if ban fields in data). Effectively requires session over HTTP |
| `POST /admin/update-user` (`:233`) | `userId`, `data` (any user fields; password via this route rejected) | Updated `User`; `banned:true` wipes sessions | `user:update` (+ `user:set-role` / `user:ban` / `user:set-email` as applicable) |
| `POST /admin/set-role` (`:44`) | `userId`, `role` | `{ user }` | `user:set-role` |
| `POST /admin/ban-user` (`:508`) | `userId`, `banReason?` (default `"No reason"`), `banExpiresIn?` (**seconds**) | `{ user }`; deletes all target sessions; cannot ban self | `user:ban` |
| `POST /admin/unban-user` (`:449`) | `userId` | `{ user }` with ban fields nulled | `user:ban` |
| `POST /admin/remove-user` (`:755`) | `userId` | `{ success: true }`; deletes sessions then user; cannot remove self; 404 if unknown | `user:delete` |
| `POST /admin/list-user-sessions` (`:403`) | `userId` | `{ sessions }` | `session:list` |
| `POST /admin/revoke-user-session` (`:669`) | `sessionToken` (opaque **token**, not id) | `{ success: true }` | `session:revoke` |
| `POST /admin/revoke-user-sessions` (`:712`) | `userId` | `{ success: true }` | `session:revoke` |
| `POST /admin/set-user-password` (`:804`) | `userId`, `newPassword` (length rules enforced; creates credential account if none) | `{ status: true }` | `user:set-password` |
| `POST /admin/has-permission` (`:871`) | `{ userId? \| role? }` + `permission` or `permissions`; NO adminMiddleware (public; used by `permissions` macro) | `{ success, error }` | none (it IS the check) |

Permission vocabulary: `user: [create, list, set-role, ban, impersonate, impersonate-admins, delete, set-password, set-email, get, update]`, `session: [list, revoke, delete]`.

Impersonate (`POST /admin/impersonate-user`, `POST /admin/stop-impersonating`) exists but is OUT OF SCOPE for this effort.
