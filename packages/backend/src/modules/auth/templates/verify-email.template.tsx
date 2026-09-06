import { Heading, Hr, Link, Text } from "react-email"

import { EmailCard, EmailCta, EmailLayout, type BaseEmailProps } from "../../../common/email/email.layout.js"
import { getTranslator } from "../../../common/translator.js"

export interface VerifyEmailProps extends BaseEmailProps {
  name: string
  email: string
  verificationUrl: string
  expiresInMinutes: number
}

export default function VerifyEmail(props: Readonly<VerifyEmailProps>) {
  const t = getTranslator(props.locale)

  return (
    <EmailLayout locale={props.locale} preview={t("email.verifyEmail.preview")}>
      <EmailCard>
        <Heading as="h1" className="text-2xl font-bold text-gray-800">
          {t("email.verifyEmail.title")}
        </Heading>
        <Text className="text-base leading-7 text-gray-800">
          {t("email.verifyEmail.intro", { name: props.name, email: props.email })}
        </Text>
        <Text className="text-base leading-7 text-gray-800">
          {t("email.verifyEmail.expires", { expires: props.expiresInMinutes })}
        </Text>
        <EmailCta href={props.verificationUrl}>{t("email.verifyEmail.cta")}</EmailCta>
        <Hr className="border-solid border-gray-200 my-6" />
        <Text className="text-sm text-gray-500 leading-5">{t("email.verifyEmail.ignore")}</Text>
        <Text className="text-sm text-gray-500 leading-5">{t("email.verifyEmail.fallbackLabel")}</Text>
        <Link href={props.verificationUrl} className="text-sm text-brand-secondary break-all">
          {props.verificationUrl}
        </Link>
      </EmailCard>
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
  to: props.email,
  subject: getTranslator(props.locale)("email.verifyEmail.subject"),
  idempotencyKey: `verify-email/${props.email.toLowerCase().trim()}`,
  react: <VerifyEmail {...props} />
})
