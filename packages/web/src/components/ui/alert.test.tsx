import { render } from "@testing-library/react"
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert"

describe("Alert", () => {
  it("renders with alert role for the default variant", () => {
    const { getByRole } = render(
      <Alert>
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>A verification link was sent.</AlertDescription>
      </Alert>
    )

    const alert = getByRole("alert")

    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain("Check your email")
    expect(alert.textContent).toContain("A verification link was sent.")
  })

  it("renders with alert role for the destructive variant", () => {
    const { getByRole } = render(
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Email already taken</AlertDescription>
      </Alert>
    )

    const alert = getByRole("alert")

    expect(alert.textContent).toContain("Email already taken")
  })

  it("forwards arbitrary props to the root element", () => {
    const { getByRole } = render(
      <Alert data-testid="custom-alert">
        <AlertTitle>Notice</AlertTitle>
      </Alert>
    )

    expect(getByRole("alert").getAttribute("data-testid")).toBe("custom-alert")
  })
})
