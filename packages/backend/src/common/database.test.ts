import { faker } from "@faker-js/faker"

import { hasPgCode, isUniqueViolation } from "./database.js"

function codedError(code: string, cause?: unknown): Error {
  const error = new Error(faker.lorem.sentence())
  Object.assign(error, { code })
  if (cause !== undefined) error.cause = cause
  return error
}

describe("hasPgCode", () => {
  test("matches the code on the error itself", () => {
    expect(hasPgCode(codedError("23505"), "23505")).toBe(true)
  })

  test("matches the code nested in the cause chain", () => {
    // SAFETY: mirrors Drizzle wrapping the driver error in DrizzleQueryError.cause
    const wrapped = new Error(faker.lorem.sentence(), { cause: codedError("23505") })

    expect(hasPgCode(wrapped, "23505")).toBe(true)
  })

  test("rejects a different code", () => {
    expect(hasPgCode(codedError("23503"), "23505")).toBe(false)
  })

  test("rejects an error without a code", () => {
    expect(hasPgCode(new Error(faker.lorem.sentence()), "23505")).toBe(false)
  })

  test("rejects non-Error values", () => {
    expect(hasPgCode(faker.lorem.sentence(), "23505")).toBe(false)
    expect(hasPgCode(undefined, "23505")).toBe(false)
  })
})

describe("isUniqueViolation", () => {
  test("accepts 23505 including when wrapped", () => {
    // SAFETY: mirrors Drizzle wrapping the driver error in DrizzleQueryError.cause
    const wrapped = new Error(faker.lorem.sentence(), { cause: codedError("23505") })

    expect(isUniqueViolation(codedError("23505"))).toBe(true)
    expect(isUniqueViolation(wrapped)).toBe(true)
  })

  test("rejects other codes", () => {
    expect(isUniqueViolation(codedError("23503"))).toBe(false)
    expect(isUniqueViolation(new Error(faker.lorem.sentence()))).toBe(false)
  })
})
