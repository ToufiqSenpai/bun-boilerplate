import type { App } from "@bun-boilerplate/backend"
import { ac, roles } from "@bun-boilerplate/backend/auth"
import { treaty } from "@elysiajs/eden"
import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeaders, getRequestUrl } from "@tanstack/react-start/server"
import { adminClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const api = treaty<App>(import.meta.env.VITE_API_URL, {
  fetch: { credentials: "include" }
}).api

const isomorphicFetch = createIsomorphicFn()
  .server((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set("cookie", getRequestHeaders().get("cookie") ?? "")
    headers.set("origin", getRequestUrl({ xForwardedHost: true }).origin)

    return fetch(input, { ...init, headers })
  })
  .client((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))

export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_API_URL}/api/auth`,
  fetchOptions: {
    credentials: "include",
    customFetchImpl: isomorphicFetch
  },
  // Single access-control matrix shared with the server plugin; the client mirrors it for typed operations and local permission checks.
  plugins: [adminClient({ ac, roles })]
})
