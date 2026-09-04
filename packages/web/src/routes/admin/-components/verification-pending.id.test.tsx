import { fireEvent, render, screen } from "@testing-library/react"

import { i18n } from "src/i18n"

await i18n.changeLanguage("id")
const { VerificationPendingCard } = await import("src/routes/admin/-components/verification-pending")

describe("VerificationPendingCard (Locale id)", () => {
  test("renders the pending alert in Indonesian with email and 30-minute expiry", () => {
    render(
      <VerificationPendingCard email="admin@example.com" onResend={async () => ({ error: null })} onBackToLogin={() => {}} />
    )

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Cek email Anda")
    expect(alert.textContent).toContain("admin@example.com")
    expect(alert.textContent).toContain("30 menit")
    expect(screen.getByRole("button", { name: "Kirim ulang email" })).toBeTruthy()
    expect(screen.getByText(/Kirim ulang dalam \d+ detik/)).toBeTruthy()
    expect(screen.getByText("Kembali ke login")).toBeTruthy()
  })

  test("shows the localized rate-limited message", () => {
    vi.useFakeTimers()
    try {
      render(
        <VerificationPendingCard
          email="admin@example.com"
          onResend={async () => ({ error: { status: 429 } })}
          onBackToLogin={() => {}}
        />
      )

      fireEvent.click(screen.getByRole("button", { name: "Kirim ulang email" }))

      expect(screen.queryByText("Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.")).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
