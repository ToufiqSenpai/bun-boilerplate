import type { TFunction } from "i18next"
import type { ReactNode } from "react"
import { Button, Container, Heading, Hr, Link, Preview, Section, Text } from "react-email"

import { EmailTemplate } from "../../../common/email.js"

export interface ResetPasswordProps {
  name: string
  email: string
  resetUrl: string
  expiresInMinutes: number
}

export class ResetPasswordTemplate extends EmailTemplate<ResetPasswordProps> {
  public subjectKey(): string {
    return "email.resetPassword.subject"
  }

  public getEntityId(): string {
    return this.props.resetUrl
  }

  public buildTemplate(t: TFunction, props: ResetPasswordProps): ReactNode {
    const { name, email, resetUrl, expiresInMinutes } = props

    return (
      <>
        <Preview>{t("email.resetPassword.preview")}</Preview>
        <Container className="mx-auto py-10 px-5 max-w-xl">
          <Section className="bg-surface rounded p-6">
            <Heading as="h1" className="text-2xl font-bold text-gray-800">
              {t("email.resetPassword.title")}
            </Heading>
            <Text className="text-base leading-7 text-gray-800">{t("email.resetPassword.intro", { name, email })}</Text>
            <Text className="text-base leading-7 text-gray-800">
              {t("email.resetPassword.expires", { expires: expiresInMinutes })}
            </Text>
            <Button
              href={resetUrl}
              className="bg-brand-primary text-white px-7 py-3.5 rounded block text-center font-bold my-6 no-underline box-border"
            >
              {t("email.resetPassword.cta")}
            </Button>
            <Hr className="border-solid border-gray-200 my-6" />
            <Text className="text-sm text-gray-500 leading-5">{t("email.resetPassword.ignore")}</Text>
            <Text className="text-sm text-gray-500 leading-5">{t("email.resetPassword.once")}</Text>
            <Text className="text-sm text-gray-500 leading-5">{t("email.resetPassword.fallbackLabel")}</Text>
            <Link href={resetUrl} className="text-sm text-brand-secondary break-all">
              {resetUrl}
            </Link>
          </Section>
        </Container>
      </>
    )
  }
}
