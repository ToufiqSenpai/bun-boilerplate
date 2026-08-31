import type { App } from "@bun-boilerplate/backend"
import { treaty } from "@elysiajs/eden"
import { createAuthClient } from "better-auth/react"

export const api = treaty<App>(import.meta.env.VITE_API_URL, {
  fetch: { credentials: "include" }
}).api

export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_API_URL}/api/auth`,
  fetchOptions: {
    credentials: "include"
  }
})
