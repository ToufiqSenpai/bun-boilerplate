import { treaty } from "@elysiajs/eden"
import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"

import { database } from "../src/common/database.js"
import { emailService } from "../src/common/email.js"
import { app } from "../src/main.js"
import { auth } from "../src/modules/auth/index.js"
import { users } from "../src/modules/auth/tables/auth.table.js"
import { createAuthSession } from "./helpers/auth.js"

const api = treaty(app)

describe("GET /api/auth/setup", () => {
  test("returns needed true on fresh database", async () => {
    const { data, error, status } = await api.api.auth.setup.get()

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data).toEqual({ needed: true })
  })

  test("returns needed false after first user exists", async () => {
    await createAuthSession("admin")

    const { data, error, status } = await api.api.auth.setup.get()

    expect(error).toBeNull()
    expect(status).toBe(200)
    expect(data).toEqual({ needed: false })
  })

  test("first signup via better-auth becomes admin and makes setup not needed", async () => {
    await database.delete(users)

    const spy = vi.spyOn(emailService, "send").mockResolvedValue(undefined)

    try {
      const email = faker.internet.email().toLowerCase()
      const password = `${faker.internet.password({ length: 12 })}A1!`
      const name = faker.person.fullName()

      const { response } = await auth.api.signUpEmail({
        body: { email, password, name },
        headers: new Headers(),
        returnHeaders: true
      })

      const [row] = await database.select().from(users).where(eq(users.id, response.user.id))

      expect(row?.role).toBe("admin")
      expect(row?.emailVerified).toBe(true)

      const { data, status } = await api.api.auth.setup.get()
      expect(status).toBe(200)
      expect(data?.needed).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  test("second user is not promoted to admin", async () => {
    await database.delete(users)

    const spy = vi.spyOn(emailService, "send").mockResolvedValue(undefined)

    try {
      const email1 = faker.internet.email().toLowerCase()
      const password1 = `${faker.internet.password({ length: 12 })}A1!`
      const name1 = faker.person.fullName()

      const email2 = faker.internet.email().toLowerCase()
      const password2 = `${faker.internet.password({ length: 12 })}A1!`
      const name2 = faker.person.fullName()

      const { response: r1 } = await auth.api.signUpEmail({
        body: { email: email1, password: password1, name: name1 },
        headers: new Headers(),
        returnHeaders: true
      })

      const { response: r2 } = await auth.api.signUpEmail({
        body: { email: email2, password: password2, name: name2 },
        headers: new Headers(),
        returnHeaders: true
      })

      const [row1] = await database.select().from(users).where(eq(users.id, r1.user.id))
      const [row2] = await database.select().from(users).where(eq(users.id, r2.user.id))

      expect(row1?.role).toBe("admin")
      expect(row2?.role).not.toBe("admin")
    } finally {
      spy.mockRestore()
    }
  })
})
