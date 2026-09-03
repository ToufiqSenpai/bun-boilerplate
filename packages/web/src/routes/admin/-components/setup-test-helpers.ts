import { fireEvent, screen } from "@testing-library/react"

interface SetupFieldLabels {
  readonly name: string
  readonly email: string
  readonly password: string
  readonly confirmPassword: string
}

interface ValidSetupValues {
  readonly name: string
  readonly email: string
  readonly password: string
  readonly confirmPassword: string
}

const VALID_SETUP_VALUES: ValidSetupValues = {
  name: "Admin",
  email: "admin@example.com",
  password: "password123",
  confirmPassword: "password123"
}

function fillValidSetupForm(labels: SetupFieldLabels, values: ValidSetupValues = VALID_SETUP_VALUES): void {
  fireEvent.change(screen.getByLabelText(labels.name), { target: { value: values.name } })
  fireEvent.change(screen.getByLabelText(labels.email), { target: { value: values.email } })
  fireEvent.change(screen.getByLabelText(labels.password), { target: { value: values.password } })
  fireEvent.change(screen.getByLabelText(labels.confirmPassword), { target: { value: values.confirmPassword } })
}

function touchSetupField(label: string, value: string): void {
  const input = screen.getByLabelText(label)
  // Type then set the target value: TanStack skips validation when the value is unchanged.
  fireEvent.change(input, { target: { value: `${value}x` } })
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

export { VALID_SETUP_VALUES, fillValidSetupForm, touchSetupField }
export type { SetupFieldLabels, ValidSetupValues }
