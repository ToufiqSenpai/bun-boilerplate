import type { Locale } from "@bun-boilerplate/i18n"

import { getTranslator } from "../../../common/i18n.js"
import { ActionEmail, EmailLayout } from "./email-layout.js"

export interface ResetPasswordProps {
  locale: Locale
  name: string
  email: string
  resetUrl: string
  expiresInMinutes: number
}

export default function ResetPassword(props: ResetPasswordProps) {
  const t = getTranslator(props.locale)

  return (
    <EmailLayout locale={props.locale} preview={t("email.resetPassword.preview")}>
      <ActionEmail
        heading={t("email.resetPassword.title")}
        intro={t("email.resetPassword.intro", { name: props.name, email: props.email })}
        expires={t("email.resetPassword.expires", { expires: props.expiresInMinutes })}
        ctaLabel={t("email.resetPassword.cta")}
        url={props.resetUrl}
        footnotes={[t("email.resetPassword.ignore"), t("email.resetPassword.once")]}
        fallbackLabel={t("email.resetPassword.fallbackLabel")}
      />
    </EmailLayout>
  )
}

ResetPassword.PreviewProps = {
  locale: "en",
  name: "John",
  email: "john@example.com",
  resetUrl: "https://example.com/reset/token-abc123",
  expiresInMinutes: 30
} satisfies ResetPasswordProps

export const resetPasswordOptions = (props: ResetPasswordProps) => ({
  subject: getTranslator(props.locale)("email.resetPassword.subject"),
  idempotencyKey: `reset-password/${props.email.toLowerCase().trim()}`,
  react: <ResetPassword {...props} />
})
