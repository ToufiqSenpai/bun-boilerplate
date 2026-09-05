import { fireEvent, render, screen } from "@testing-library/react"
import { AdminLoginPage, requireSetupComplete, type AdminLoginPageProps } from "src/routes/admin/login"

interface GuardInput {
  readonly data: { readonly needed: boolean } | null | undefined
  readonly error: unknown
  readonly status: number
}
function redirectsToSetup(result: GuardInput): boolean {
  try {
    requireSetupComplete(result)
    return false
  } catch {
    return true
  }
}

describe("requireSetupComplete", () => {
  test("redirects to /admin/setup when setup is still needed", () => {
    expect(redirectsToSetup({ data: { needed: true }, error: null, status: 200 })).toBe(true)
  })

  test("allows sign-in when setup is complete", () => {
    expect(redirectsToSetup({ data: { needed: false }, error: null, status: 200 })).toBe(false)
  })

  test("allows sign-in when the setup check fails", () => {
    expect(redirectsToSetup({ data: null, error: { message: "boom" }, status: 500 })).toBe(false)
  })
})

function renderLogin(props: Partial<AdminLoginPageProps> = {}) {
  return render(
    <AdminLoginPage
      {...props}
      onSignedIn={props.onSignedIn ?? (() => {})}
      onGoToPending={props.onGoToPending ?? (() => {})}
    />
  )
}

const LABELS = {
  email: "Email",
  password: "Password"
} as const

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(LABELS.email), { target: { value: "admin@example.com" } })
  fireEvent.change(screen.getByLabelText(LABELS.password), { target: { value: "password123" } })
}

function touchField(label: string, value: string) {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value: `${value}x` } })
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe("AdminLoginPage", () => {
  test("renders the login form through the real route wiring", () => {
    renderLogin()

    expect(screen.getByText("Admin Login")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy()
  })

  test("renders header copy and localized labels", () => {
    renderLogin({ onSignIn: async () => ({ error: null }) })

    expect(screen.getByText("Admin Login")).toBeTruthy()
    expect(screen.getByText("Sign in to access the admin dashboard.")).toBeTruthy()
    expect(screen.getByLabelText(LABELS.email)).toBeTruthy()
    expect(screen.getByLabelText(LABELS.password)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy()
  })

  test.each([
    { label: LABELS.email, value: "not-an-email", expected: "Enter a valid email address" },
    { label: LABELS.password, value: "", expected: "Password is required" }
  ])("shows inline validation error: $expected", async ({ label, value, expected }) => {
    renderLogin({ onSignIn: async () => ({ error: null }) })

    touchField(label, value)

    expect(await screen.findByText(expected)).toBeTruthy()
  })

  test("toggles password visibility with an accessible mask button", () => {
    renderLogin({ onSignIn: async () => ({ error: null }) })

    const passwordInput = screen.getByLabelText(LABELS.password)
    expect(passwordInput.getAttribute("type")).toBe("password")
    expect(passwordInput.getAttribute("autocomplete")).toBe("current-password")

    fireEvent.click(screen.getByRole("button", { name: "Show password" }))

    expect(passwordInput.getAttribute("type")).toBe("text")
    expect(screen.getByRole("button", { name: "Hide password" })).toBeTruthy()
  })

  test("shows a single generic destructive alert on any sign-in failure", async () => {
    renderLogin({ onSignIn: async () => ({ error: { message: "User not found" } }) })

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Email or password is incorrect")
    expect(alert.dataset.slot).toBe("alert")
    expect(screen.queryByText("User not found")).toBeNull()
  })

  test("navigates to the validated return address on success", async () => {
    const destinations: string[] = []
    renderLogin({
      returnTo: "/admin/articles?sort=asc",
      onSignIn: async () => ({ error: null }),
      onSignedIn: to => {
        destinations.push(to)
      }
    })

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await screen.findByRole("button", { name: "Sign in" })
    expect(destinations).toEqual(["/admin/articles?sort=asc"])
  })

  test("falls back to the admin home when the return address is not an internal admin path", async () => {
    const destinations: string[] = []
    renderLogin({
      returnTo: "//evil.com",
      onSignIn: async () => ({ error: null }),
      onSignedIn: to => {
        destinations.push(to)
      }
    })

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await screen.findByRole("button", { name: "Sign in" })
    expect(destinations).toEqual(["/admin/"])
  })

  test("a pending-verification sign-in goes to the pending state with the typed address", async () => {
    const pending: string[] = []
    renderLogin({
      onSignIn: async () => ({ error: { code: "EMAIL_NOT_VERIFIED", status: 403 } }),
      onGoToPending: email => {
        pending.push(email)
      }
    })

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await screen.findByRole("button", { name: "Sign in" })
    expect(pending).toEqual(["admin@example.com"])
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("a generic failure keeps the form usable for retry and logs the reason without personal data", async () => {
    const logged: unknown[] = []
    const warn = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      logged.push(args)
    })
    try {
      renderLogin({ onSignIn: async () => ({ error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } }) })

      fillValidForm()
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

      await screen.findByRole("alert")
      expect(warn).toHaveBeenCalled()
      expect(JSON.stringify(logged)).toContain('"bad-credentials"')
      expect(JSON.stringify(logged)).toContain("401")
      expect(JSON.stringify(logged)).not.toContain("admin@example.com")
      expect(screen.queryByText("admin@example.com")).toBeNull()

      const submit = screen.getByRole("button", { name: "Sign in" })
      expect(submit.hasAttribute("disabled")).toBe(false)
    } finally {
      warn.mockRestore()
    }
  })

  test("sends the entered credentials to the sign-in seam exactly once", async () => {
    const calls: { email: string; password: string }[] = []
    renderLogin({
      onSignIn: async input => {
        calls.push(input)
        return { error: null }
      }
    })

    fillValidForm()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await screen.findByRole("button", { name: "Sign in" })
    expect(calls).toEqual([{ email: "admin@example.com", password: "password123" }])
  })

  test("disables the button with a loading state while signing in", async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    renderLogin({
      onSignIn: async () => {
        await gate
        return { error: null }
      }
    })

    fillValidForm()
    const submit = screen.getByRole("button", { name: "Sign in" })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(await screen.findByText("Signing in…")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Signing in…" }).hasAttribute("disabled")).toBe(true)

    release()

    await screen.findByText("Sign in")
  })
})
