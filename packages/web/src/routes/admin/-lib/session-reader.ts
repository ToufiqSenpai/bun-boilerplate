import type { AdminSessionResult } from "src/routes/admin/-lib/access"
import { authClient } from "src/utils/client"

// The web client's generic better-auth type omits the admin-plugin role field, which the backend does send.
export async function readAdminSession(): Promise<AdminSessionResult> {
  const { data, error } = await authClient.getSession()
  const user = data?.user

  if (!user) return { data: null, error }

  // SAFETY: the backend admin plugin includes `role` on every session user; the generic client type just omits it.
  const role = (user as { role?: string | null }).role ?? null

  return {
    data: {
      user: {
        email: user.email,
        emailVerified: user.emailVerified,
        role
      }
    },
    error
  }
}
