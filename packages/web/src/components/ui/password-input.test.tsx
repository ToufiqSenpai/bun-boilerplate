import { fireEvent, render } from "@testing-library/react"
import { PasswordInput } from "src/components/ui/password-input"

function getInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("input")

  if (!input) {
    throw new Error("PasswordInput did not render an input")
  }

  return input
}

describe("PasswordInput", () => {
  it("renders a masked password input with forwarded attributes", () => {
    const { container } = render(<PasswordInput id="password" name="password" defaultValue="secret" />)

    const input = getInput(container)

    expect(input.type).toBe("password")
    expect(input.id).toBe("password")
    expect(input.name).toBe("password")
    expect(input.value).toBe("secret")
  })

  it("toggles the input type via a focusable button with an accessible name", () => {
    const { container, getByRole } = render(<PasswordInput aria-label="Password" />)

    const toggle = getByRole("button", { name: "Show password" })

    expect(toggle.tagName.toLowerCase()).toBe("button")

    fireEvent.click(toggle)

    expect(getInput(container).type).toBe("text")
    expect(getByRole("button", { name: "Hide password" })).toBeTruthy()
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
  })

  it("toggles back to masked on a second click", () => {
    const { container, getByRole } = render(<PasswordInput />)

    fireEvent.click(getByRole("button", { name: "Show password" }))
    fireEvent.click(getByRole("button", { name: "Hide password" }))

    expect(getInput(container).type).toBe("password")
    expect(getByRole("button", { name: "Show password" })).toBeTruthy()
  })

  it("accepts custom toggle labels for localization", () => {
    const { getByRole } = render(
      <PasswordInput showPasswordLabel="Tampilkan password" hidePasswordLabel="Sembunyikan password" />
    )

    fireEvent.click(getByRole("button", { name: "Tampilkan password" }))

    expect(getByRole("button", { name: "Sembunyikan password" })).toBeTruthy()
  })

  it("forwards change events to the underlying input", () => {
    const { container } = render(<PasswordInput value="typed" readOnly />)

    expect(getInput(container).value).toBe("typed")
  })
})
