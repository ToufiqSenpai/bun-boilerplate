import type { ReactNode } from "react"
import { Field, FieldError, FieldLabel } from "src/components/ui/field"
import { z } from "zod"

interface FieldChromeProps {
  readonly id: string
  readonly label: string
  readonly touched: boolean
  readonly messages: readonly string[]
  readonly children: ReactNode
}

function FieldChrome({ id, label, touched, messages, children }: FieldChromeProps) {
  return (
    <Field data-invalid={messages.length > 0}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {touched && messages.length > 0 && <FieldError errors={messages.map(message => ({ message }))} />}
    </Field>
  )
}

function fieldValidator(schema: z.ZodType<string>) {
  return ({ value }: { value: string }): string | undefined => {
    const result = schema.safeParse(value)
    if (result.success) return undefined
    return result.error.issues[0]?.message
  }
}

export { FieldChrome, fieldValidator }
export type { FieldChromeProps }
