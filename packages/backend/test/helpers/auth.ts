import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"

import { database } from "../../src/common/database.js"
import { emailService } from "../../src/common/email.js"
import { auth } from "../../src/modules/auth/index.js"
import { users } from "../../src/modules/auth/tables/auth.table.js"

export interface UnverifiedSignUp {
  userId: string
  token: string | null
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
    const { response } = await auth.api.signUpEmail({
      body: { email, password, name: faker.person.fullName() },
      headers,
      returnHeaders: true
    })

    return { userId: response.user.id, token: response.token }
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
