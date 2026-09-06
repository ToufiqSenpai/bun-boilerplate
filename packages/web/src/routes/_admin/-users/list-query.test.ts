import { buildListUsersQuery, inferSearchField, pageOffset, USERS_PAGE_SIZE } from "src/routes/_admin/-users/list-query"

describe("pageOffset", () => {
  test("maps one-based pages to zero-based offsets of twenty rows", () => {
    expect(pageOffset(1)).toBe(0)
    expect(pageOffset(2)).toBe(20)
    expect(pageOffset(5)).toBe(80)
  })
})

describe("inferSearchField", () => {
  test("an address containing @ searches email, otherwise name", () => {
    expect(inferSearchField("ada@dev.io")).toBe("email")
    expect(inferSearchField("ada")).toBe("name")
  })
})

describe("buildListUsersQuery", () => {
  test("maps the default state to a newest-first page request", () => {
    expect(buildListUsersQuery({ page: 1, q: "", sortBy: "createdAt", desc: true })).toEqual({
      limit: USERS_PAGE_SIZE,
      offset: 0,
      sortBy: "createdAt",
      sortDirection: "desc"
    })
  })

  test("maps a name search on page two to a contains request with an offset", () => {
    expect(buildListUsersQuery({ page: 2, q: "grace", sortBy: "name", desc: false })).toEqual({
      limit: USERS_PAGE_SIZE,
      offset: 20,
      sortBy: "name",
      sortDirection: "asc",
      searchValue: "grace",
      searchField: "name",
      searchOperator: "contains"
    })
  })

  test("maps an email search to the email field", () => {
    expect(buildListUsersQuery({ page: 1, q: "ada@dev.io", sortBy: "name", desc: true }).searchField).toBe("email")
  })
})
