import { fireEvent, render, screen } from "@testing-library/react"
import type { AdminUser } from "src/routes/_admin/-users/map-record"
import { UsersPage, type UsersPageProps } from "src/routes/_admin/admin.users"

const users: AdminUser[] = [
  {
    id: "u1",
    name: "Ada Lovelace",
    email: "ada@dev.io",
    role: "superadmin",
    emailVerified: true,
    createdAt: "2026-01-02T00:00:00.000Z",
    banned: false,
    banReason: null,
    banExpires: null
  },
  {
    id: "u2",
    name: "Grace Hopper",
    email: "grace@dev.io",
    role: "admin",
    emailVerified: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    banned: true,
    banReason: "abuse",
    banExpires: "2026-09-01T00:00:00.000Z"
  }
]

function renderPage(overrides: Partial<UsersPageProps> = {}) {
  const search: unknown[] = []
  const sort: unknown[] = []
  const page: unknown[] = []
  const open: unknown[] = []

  const props: UsersPageProps = {
    state: { page: 1, q: "", sortBy: "createdAt", desc: true },
    status: "success",
    users,
    total: users.length,
    onSearch: q => search.push(q),
    onSort: field => sort.push(field),
    onPage: p => page.push(p),
    onOpen: user => open.push(user),
    ...overrides
  }

  render(<UsersPage {...props} />)

  return { search, sort, page, open }
}

describe("UsersPage", () => {
  test("renders the Users heading and column headers", () => {
    renderPage()

    expect(screen.getByRole("heading", { name: "Users" })).toBeTruthy()
    for (const column of ["Name", "Email", "Role", "Verification", "Ban", "Created"]) {
      expect(screen.getByText(column)).toBeTruthy()
    }
  })

  test("renders name, email, Role, Verification state, and Ban state per row", () => {
    renderPage()

    const adaRow = screen.getByText("Ada Lovelace").closest("tr")
    const graceRow = screen.getByText("Grace Hopper").closest("tr")

    expect(adaRow?.textContent).toContain("ada@dev.io")
    expect(graceRow?.textContent).toContain("grace@dev.io")

    expect(adaRow?.textContent).toContain("superadmin")
    expect(adaRow?.textContent).toContain("Verified")
    expect(adaRow?.textContent).toContain("Active")
    expect(graceRow?.textContent).toContain("admin")
    expect(graceRow?.textContent).toContain("Unverified")
    expect(graceRow?.textContent).toContain("Banned")
  })

  test("submits the search draft through the injected callback", () => {
    const calls = renderPage()

    fireEvent.change(screen.getByPlaceholderText("Search by name or email"), { target: { value: "grace" } })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))

    expect(calls.search).toEqual(["grace"])
  })

  test("sort column headers report their field", () => {
    const calls = renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Name" }))
    fireEvent.click(screen.getByRole("button", { name: "Email" }))
    fireEvent.click(screen.getByRole("button", { name: "Created" }))

    expect(calls.sort).toEqual(["name", "email", "createdAt"])
  })

  test("pagination advances pages and disables controls at the bounds", () => {
    const calls = renderPage({ total: 60 })

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }))
    expect(calls.page).toEqual([2])
    expect(screen.getByRole("button", { name: "Go to previous page" }).getAttribute("aria-disabled")).toBe("true")
  })

  test("next page is disabled on the last page", () => {
    renderPage({ state: { page: 3, q: "", sortBy: "createdAt", desc: true }, total: 60 })

    expect(screen.getByRole("button", { name: "Go to next page" }).getAttribute("aria-disabled")).toBe("true")
  })

  test("activating a row opens the detail seam with that User", () => {
    const calls = renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }))

    expect(calls.open).toEqual([users[0]])
  })

  test("pending status shows no rows and no error", () => {
    renderPage({ status: "pending", users: [] })

    expect(screen.queryByText("Ada Lovelace")).toBeNull()
    expect(screen.queryByText("Something went wrong. Please try again.")).toBeNull()
  })

  test("error status shows a generic alert without identifiers", () => {
    renderPage({ status: "error", users: [] })

    expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy()
    expect(screen.queryByText("Ada Lovelace")).toBeNull()
  })

  test("empty result shows the empty state", () => {
    renderPage({ users: [] })

    expect(screen.getByText("No Users found")).toBeTruthy()
    expect(screen.getByText("No User matches the current search.")).toBeTruthy()
  })
})
