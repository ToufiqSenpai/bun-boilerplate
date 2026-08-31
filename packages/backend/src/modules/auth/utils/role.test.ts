import { faker } from "@faker-js/faker"

import { hasRole } from "./role.js"

describe("hasRole", () => {
  test("returns true when single role matches", () => {
    expect(hasRole({ role: "admin" }, "admin")).toBe(true)
  })

  test("returns true when role is one of multiple comma-separated roles", () => {
    const extraRole = faker.lorem.word()
    expect(hasRole({ role: `${extraRole},admin` }, "admin")).toBe(true)
  })

  test("returns false when role does not match", () => {
    expect(hasRole({ role: "user" }, "admin")).toBe(false)
  })

  test("returns false when no role in list matches", () => {
    const roles = [faker.lorem.word(), faker.lorem.word()]
    expect(hasRole({ role: roles.join(",") }, "admin")).toBe(false)
  })

  test("does not match role as a substring of another role", () => {
    expect(hasRole({ role: "superadmin" }, "admin")).toBe(false)
  })

  test("returns false when role is undefined", () => {
    expect(hasRole({}, "admin")).toBe(false)
  })

  test("returns false when role is null", () => {
    expect(hasRole({ role: null }, "admin")).toBe(false)
  })
})
