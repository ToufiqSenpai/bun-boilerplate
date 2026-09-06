import { fireEvent, render, screen } from "@testing-library/react"
import { UserDetailDrawer, type UserDetailDrawerProps } from "src/routes/_admin/-users/user-drawer"
import type { AdminUser } from "src/routes/_admin/-users/users-page"

const user: AdminUser = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@dev.io",
  role: "superadmin",
  emailVerified: true,
  createdAt: "2026-01-02T00:00:00.000Z",
  banned: false,
  banReason: null,
  banExpires: null
}

const sessions = [
  { id: "s1", expiresAt: "2026-09-20T00:00:00.000Z", ipAddress: "203.0.113.7", userAgent: "Firefox on Linux" },
  { id: "s2", expiresAt: "2026-09-21T00:00:00.000Z", ipAddress: null, userAgent: null }
]

function renderDrawer(overrides: Partial<UserDetailDrawerProps> = {}) {
  const closed: number[] = []
  const props: UserDetailDrawerProps = {
    user,
    status: "success",
    sessions,
    onClose: () => closed.push(1),
    ...overrides
  }

  render(<UserDetailDrawer {...props} />)

  return closed
}

describe("UserDetailDrawer", () => {
  test("renders nothing when no User is selected", () => {
    renderDrawer({ user: null })

    expect(screen.queryByRole("dialog")).toBeNull()
  })

  test("shows the User profile fields", () => {
    renderDrawer()

    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeTruthy()
    expect(screen.getByText("ada@dev.io")).toBeTruthy()
    expect(screen.getByText("superadmin")).toBeTruthy()
    expect(screen.getByText("Verified")).toBeTruthy()
    expect(screen.getByText("Active")).toBeTruthy()
    expect(screen.getByText("2026-01-02")).toBeTruthy()
  })

  test("lists the User Sessions with expiry and device", () => {
    renderDrawer()

    expect(screen.getByText("Sessions")).toBeTruthy()
    expect(screen.getByText("Firefox on Linux")).toBeTruthy()
    expect(screen.getByText("203.0.113.7")).toBeTruthy()
    expect(screen.getByText("Unknown device")).toBeTruthy()
    expect(screen.getAllByText(/2026-09-20/)).toHaveLength(1)
    expect(screen.getAllByText(/2026-09-21/)).toHaveLength(1)
  })

  test("shows an empty state when the User has no Sessions", () => {
    renderDrawer({ sessions: [] })

    expect(screen.getByText("No active Sessions.")).toBeTruthy()
  })

  test("shows a generic alert when Sessions fail to load", () => {
    renderDrawer({ status: "error", sessions: [] })

    expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy()
  })

  test("shows skeleton rows while Sessions load", () => {
    renderDrawer({ status: "pending", sessions: [] })

    expect(screen.getByText("Sessions")).toBeTruthy()
    expect(screen.queryByText("No active Sessions.")).toBeNull()
  })

  test("the close button reports through the injected callback", () => {
    const closed = renderDrawer()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(closed).toHaveLength(1)
  })
})
