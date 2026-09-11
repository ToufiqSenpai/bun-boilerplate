import type { App } from "@bun-boilerplate/backend"
import { ac } from "@bun-boilerplate/backend/auth"
import { treaty } from "@elysiajs/eden"
import { adminClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const api = treaty<App>(import.meta.env.VITE_API_URL, {
  fetch: { credentials: "include" }
}).api

export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_API_URL}/api/auth`,
  fetchOptions: {
    credentials: "include"
  },
  // Single access-control matrix shared with the server plugin; the client mirrors it for typed admin operations only.
  plugins: [adminClient({ ac })]
})
