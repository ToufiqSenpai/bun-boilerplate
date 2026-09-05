import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"

import { config } from "../../src/common/config.js"
import { database } from "../../src/common/database.js"
import { emailService, type SendEmailOptions } from "../../src/common/email-service.js"
import { auth } from "../../src/modules/auth/index.js"
import { users } from "../../src/modules/auth/tables/auth.table.js"

export interface UnverifiedSignUp {
  userId: string
  token: string | null
  emailOptions: SendEmailOptions | undefined
}

export interface VerifiedUser {
  userId: string
  cookie: string
}

export async function signUpUnverified(headers: Headers = new Headers()): Promise<UnverifiedSignUp> {
  const email = faker.internet.email().toLowerCase()
  const password = `${faker.internet.password({ length: 12 })}A1!`

  const spy = vi.spyOn(emailService, "send").mockResolvedValue(undefined)

  try {
    // Through the fetch handler (not auth.api directly) so better-auth materializes ctx.request
    // and sendVerificationEmail receives the real headers — the seam the locale is resolved from.
    const response = await auth.handler(
      new Request(`${config.app.baseURL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", ...Object.fromEntries(headers) },
        body: JSON.stringify({ email, password, name: faker.person.fullName() })
      })
    )
    // SAFETY: a 2xx sign-up response is better-auth's { user, token } payload; the !body.user guard below rejects anything else.
    const body = (await response.json()) as { user?: { id: string }; token?: string | null }

    if (!response.ok || !body.user) throw new Error(`sign-up failed: ${response.status} ${JSON.stringify(body)}`)

    return { userId: body.user.id, token: body.token ?? null, emailOptions: spy.mock.calls[0]?.[0] }
  } finally {
    spy.mockRestore()
  }
}

export async function createVerifiedUser(role: string): Promise<VerifiedUser> {
  const email = faker.internet.email().toLowerCase()
  const password = `${faker.internet.password({ length: 12 })}A1!`

  const spy = vi.spyOn(emailService, "send").mockResolvedValue(undefined)

  try {
    const { response } = await auth.api.signUpEmail({
      body: { email, password, name: faker.person.fullName() },
      headers: new Headers(),
      returnHeaders: true
    })

    await database.update(users).set({ role, emailVerified: true }).where(eq(users.id, response.user.id))

    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers(),
      returnHeaders: true
    })

    const cookie = headers
      .getSetCookie()
      .map(entry => entry.split(";")[0])
      .join("; ")

    return { userId: response.user.id, cookie }
  } finally {
    spy.mockRestore()
  }
}

export async function createAuthSession(role: string): Promise<Record<string, string>> {
  const { cookie } = await createVerifiedUser(role)

  return { cookie }
}
