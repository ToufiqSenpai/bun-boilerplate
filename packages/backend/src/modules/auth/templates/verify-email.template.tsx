import type { Locale } from "@bun-boilerplate/i18n"

import { getTranslator } from "../../../common/translator.js"
import { ActionEmail, EmailLayout } from "./email-layout.js"

export interface VerifyEmailProps {
  locale: Locale
  name: string
  email: string
  verificationUrl: string
  expiresInMinutes: number
}

export default function VerifyEmail(props: VerifyEmailProps) {
  const t = getTranslator(props.locale)

  return (
    <EmailLayout locale={props.locale} preview={t("email.verifyEmail.preview")}>
      <ActionEmail
        heading={t("email.verifyEmail.title")}
        intro={t("email.verifyEmail.intro", { name: props.name, email: props.email })}
        expires={t("email.verifyEmail.expires", { expires: props.expiresInMinutes })}
        ctaLabel={t("email.verifyEmail.cta")}
        url={props.verificationUrl}
        footnotes={[t("email.verifyEmail.ignore")]}
        fallbackLabel={t("email.verifyEmail.fallbackLabel")}
      />
    </EmailLayout>
  )
}

VerifyEmail.PreviewProps = {
  locale: "en",
  name: "John",
  email: "john@example.com",
  verificationUrl: "https://example.com/verify/token-abc123",
  expiresInMinutes: 30
} satisfies VerifyEmailProps

export const verifyEmailOptions = (props: VerifyEmailProps) => ({
  subject: getTranslator(props.locale)("email.verifyEmail.subject"),
  idempotencyKey: `verify-email/${props.email.toLowerCase().trim()}`,
  react: <VerifyEmail {...props} />
})
