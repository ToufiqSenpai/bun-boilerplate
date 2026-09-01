import { IconEye, IconEyeOff } from "@tabler/icons-react"
import * as React from "react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "src/components/ui/input-group"
import { cn } from "src/utils/component"

interface PasswordInputProps extends React.ComponentProps<"input"> {
  showPasswordLabel?: string
  hidePasswordLabel?: string
}

function PasswordInput({
  className,
  showPasswordLabel = "Show password",
  hidePasswordLabel = "Hide password",
  ...props
}: PasswordInputProps) {
  const [passwordVisible, setPasswordVisible] = React.useState(false)

  return (
    <InputGroup className={cn(className)}>
      <InputGroupInput type={passwordVisible ? "text" : "password"} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-xs"
          aria-label={passwordVisible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={passwordVisible}
          onClick={() => {
            setPasswordVisible(visible => !visible)
          }}
        >
          {passwordVisible ? <IconEyeOff /> : <IconEye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export { PasswordInput, type PasswordInputProps }
