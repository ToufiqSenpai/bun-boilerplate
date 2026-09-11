import { Heading, Hr, Link, Text } from "react-email"

import { EmailCard, EmailCta, EmailLayout, type BaseEmailProps } from "../../../common/email/email.layout.js"
import { getTranslator } from "../../../common/translator.js"

export interface ResetPasswordProps extends BaseEmailProps {
  name: string
  email: string
  resetUrl: string
  expiresInMinutes: number
}

export default function ResetPassword(props: Readonly<ResetPasswordProps>) {
  const t = getTranslator(props.locale)

  return (
    <EmailLayout locale={props.locale} preview={t("email.resetPassword.preview")}>
      <EmailCard>
        <Heading as="h1" className="text-2xl font-bold text-gray-800">
          {t("email.resetPassword.title")}
        </Heading>
        <Text className="text-base leading-7 text-gray-800">
          {t("email.resetPassword.intro", { name: props.name, email: props.email })}
        </Text>
        <Text className="text-base leading-7 text-gray-800">
          {t("email.resetPassword.expires", { expires: props.expiresInMinutes })}
        </Text>
        <EmailCta href={props.resetUrl}>{t("email.resetPassword.cta")}</EmailCta>
        <Hr className="border-solid border-gray-200 my-6" />
        <Text className="text-sm text-gray-500 leading-5">{t("email.resetPassword.ignore")}</Text>
        <Text className="text-sm text-gray-500 leading-5">{t("email.resetPassword.once")}</Text>
        <Text className="text-sm text-gray-500 leading-5">{t("email.resetPassword.fallbackLabel")}</Text>
        <Link href={props.resetUrl} className="text-sm text-brand-secondary break-all">
          {props.resetUrl}
        </Link>
      </EmailCard>
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
  to: props.email,
  subject: getTranslator(props.locale)("email.resetPassword.subject"),
  idempotencyKey: `reset-password/${props.email.toLowerCase().trim()}/${props.resetUrl}`,
  react: <ResetPassword {...props} />
})
