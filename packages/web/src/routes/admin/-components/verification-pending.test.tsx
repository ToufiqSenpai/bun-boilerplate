import { act, fireEvent, render, screen } from "@testing-library/react"
import { VerificationPendingCard } from "src/routes/admin/-components/verification-pending"

interface ResendResult {
  readonly error: { readonly status?: number | undefined; readonly message?: string | undefined } | null
}

function renderPending(onResend?: () => Promise<ResendResult>) {
  return render(
    <VerificationPendingCard
      email="admin@example.com"
      onResend={onResend ?? (async () => ({ error: null }))}
      onBackToLogin={() => {}}
    />
  )
}

describe("VerificationPendingCard", () => {
  test("renders the default alert with recipient email and 30-minute expiry", () => {
    const { container } = renderPending()

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Check your email")
    expect(alert.textContent).toContain("admin@example.com")
    expect(alert.textContent).toContain("30 minutes")
    expect(alert.dataset.slot).toBe("alert")
    expect(alert.className).not.toContain("text-destructive")

    expect(screen.getByRole("button", { name: "Resend email" })).toBeTruthy()
    expect(screen.getByText("Back to login")).toBeTruthy()

    // The pending card replaces the setup form entirely.
    expect(container.querySelector("form")).toBeNull()
  })

  test("disables resend during the 60s cooldown with a countdown label", () => {
    renderPending()

    expect(screen.getByRole("button", { name: "Resend email" }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByText("Resend available in 60s")).toBeTruthy()
  })

  test("enables resend after the cooldown and re-arms it on click", async () => {
    vi.useFakeTimers()
    try {
      const calls: number[] = []
      renderPending(async () => {
        calls.push(calls.length + 1)
        return { error: null }
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      const resend = screen.getByRole("button", { name: "Resend email" })
      expect(resend.hasAttribute("disabled")).toBe(false)

      fireEvent.click(resend)
      await act(async () => {})

      expect(calls).toEqual([1])
      expect(screen.getByRole("button", { name: "Resend email" }).hasAttribute("disabled")).toBe(true)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(screen.getByRole("button", { name: "Resend email" }).hasAttribute("disabled")).toBe(false)
      expect(calls).toEqual([1])
    } finally {
      vi.useRealTimers()
    }
  })

  test("shows the localized rate-limited alert as destructive on 429", async () => {
    vi.useFakeTimers()
    try {
      renderPending(async () => ({ error: { status: 429 } }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      fireEvent.click(screen.getByRole("button", { name: "Resend email" }))
      await act(async () => {})

      const alert = screen.getByText("Too many attempts. Please wait a minute and try again.")
      expect(alert.closest('[data-slot="alert"]')?.className).toContain("text-destructive")
    } finally {
      vi.useRealTimers()
    }
  })

  test("shows the generic fallback alert as destructive on other resend failures", async () => {
    vi.useFakeTimers()
    try {
      renderPending(async () => ({ error: { message: "SMTP down" } }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      fireEvent.click(screen.getByRole("button", { name: "Resend email" }))
      await act(async () => {})

      expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
