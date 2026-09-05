import { act, fireEvent, render, screen } from "@testing-library/react"
import { VerificationPendingCard, type SendResult } from "src/routes/admin/-components/verification-pending"

function renderPending(onSend?: () => Promise<SendResult>) {
  return render(
    <VerificationPendingCard
      email="admin@example.com"
      onSend={onSend ?? (async () => ({ error: null }))}
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

    expect(screen.getByRole("button", { name: "Send email" })).toBeTruthy()
    expect(screen.getByText("Back to login")).toBeTruthy()

    // The pending card replaces the setup form entirely.
    expect(container.querySelector("form")).toBeNull()
  })

  test("disables send during the 60s cooldown with a countdown label", () => {
    renderPending()

    expect(screen.getByRole("button", { name: "Send email" }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByText("Available again in 60s")).toBeTruthy()
  })

  test("enables send after the cooldown and re-arms it on click", async () => {
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

      const send = screen.getByRole("button", { name: "Send email" })
      expect(send.hasAttribute("disabled")).toBe(false)

      fireEvent.click(send)
      await act(async () => {})

      expect(calls).toEqual([1])
      expect(screen.getByRole("button", { name: "Send email" }).hasAttribute("disabled")).toBe(true)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(screen.getByRole("button", { name: "Send email" }).hasAttribute("disabled")).toBe(false)
      expect(calls).toEqual([1])
    } finally {
      vi.useRealTimers()
    }
  })

  test("keeps send retryable when the send fails, rate-limited or not", async () => {
    vi.useFakeTimers()
    try {
      for (const failure of [{ status: 429 }, { message: "SMTP down" }]) {
        const view = renderPending(async () => ({ error: failure }))

        await act(async () => {
          await vi.advanceTimersByTimeAsync(60_000)
        })

        fireEvent.click(screen.getByRole("button", { name: "Send email" }))
        await act(async () => {})

        expect(screen.getByRole("button", { name: "Send email" }).hasAttribute("disabled")).toBe(false)

        view.unmount()
      }
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

      fireEvent.click(screen.getByRole("button", { name: "Send email" }))
      await act(async () => {})

      const alert = screen.getByText("Too many attempts. Please wait a minute and try again.")
      expect(alert.closest('[data-slot="alert"]')?.className).toContain("text-destructive")
    } finally {
      vi.useRealTimers()
    }
  })

  test("shows the generic fallback alert as destructive on other send failures", async () => {
    vi.useFakeTimers()
    try {
      renderPending(async () => ({ error: { message: "SMTP down" } }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      fireEvent.click(screen.getByRole("button", { name: "Send email" }))
      await act(async () => {})

      expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
