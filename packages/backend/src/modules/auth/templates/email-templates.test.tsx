import { DEFAULT_LOCALE, type Locale } from "@bun-boilerplate/i18n"
import { faker } from "@faker-js/faker"
import { JSDOM } from "jsdom"
import type { ReactElement } from "react"
import { renderToReadableStream } from "react-dom/server"

import { getTranslator } from "../../../common/translator.js"
import ResetPassword, { type ResetPasswordProps, resetPasswordOptions } from "./reset-password.template.js"
import VerifyEmail, { verifyEmailOptions } from "./verify-email.template.js"

interface EmailCaseProps {
  locale: Locale
  name: string
  email: string
  url: string
  expiresInMinutes: number
}

interface EmailCase {
  name: string
  keys: string
  keyPrefix: string
  render: (props: EmailCaseProps) => ReactElement
  options: (props: EmailCaseProps) => { to: string; subject: string; idempotencyKey: string }
}

const baseProps = (): EmailCaseProps => ({
  locale: DEFAULT_LOCALE,
  name: faker.person.firstName(),
  email: faker.internet.email(),
  url: faker.internet.url(),
  expiresInMinutes: faker.number.int({ min: 1, max: 120 })
})

const CASES: EmailCase[] = [
  {
    name: "VerifyEmail",
    keys: "email.verifyEmail",
    keyPrefix: "verify-email",
    render: props => <VerifyEmail {...props} verificationUrl={props.url} />,
    options: props => verifyEmailOptions({ ...props, verificationUrl: props.url })
  },
  {
    name: "ResetPassword",
    keys: "email.resetPassword",
    keyPrefix: "reset-password",
    render: props => <ResetPassword {...props} resetUrl={props.url} />,
    options: props => resetPasswordOptions({ ...props, resetUrl: props.url })
  }
]

async function render(element: ReactElement): Promise<Document> {
  const stream = await renderToReadableStream(element)
  return new JSDOM(await new Response(stream).text()).window.document
}

describe.each(CASES)("$name template", templateCase => {
  test("renders with the Indonesian translations for the id locale", async () => {
    const props = { ...baseProps(), locale: "id" as const }
    const t = getTranslator("id")
    const document = await render(templateCase.render(props))

    expect(document.documentElement.getAttribute("lang")).toBe("id")
    expect(document.querySelector("h1")?.textContent).toBe(t(`${templateCase.keys}.title`))
  })

  test("interpolates name, email, and expiry into the rendered paragraphs", async () => {
    const props = baseProps()
    const t = getTranslator(props.locale)
    const document = await render(templateCase.render(props))
    const paragraphTexts = [...document.querySelectorAll("p")].map(element => element.textContent)

    expect(paragraphTexts).toContain(t(`${templateCase.keys}.intro`, { name: props.name, email: props.email }))
    expect(paragraphTexts).toContain(t(`${templateCase.keys}.expires`, { expires: props.expiresInMinutes }))
  })

  test("links the action url on the CTA button", async () => {
    const props = baseProps()
    const document = await render(templateCase.render(props))

    expect(document.querySelector(`a[href="${props.url}"]`)).not.toBeNull()
  })

  test("resolves the translated subject per locale", () => {
    const props = { ...baseProps(), locale: "id" as const }

    expect(templateCase.options(props).subject).toBe(getTranslator("id")(`${templateCase.keys}.subject`))
  })

  test("derives the idempotency key from the email address and url, so re-sends are unique", () => {
    const props = baseProps()
    const expectedKey = `${templateCase.keyPrefix}/${props.email.toLowerCase().trim()}/${props.url}`

    expect(templateCase.options(props).idempotencyKey).toBe(expectedKey)

    const resentKey = templateCase.options({ ...props, url: faker.internet.url() }).idempotencyKey

    expect(resentKey).not.toBe(expectedKey)
  })
})

test("ResetPassword includes the single-use warning as a footnote", async () => {
  const base = baseProps()
  const props: ResetPasswordProps = { ...base, resetUrl: base.url }
  const t = getTranslator(props.locale)
  const document = await render(<ResetPassword {...props} />)
  const paragraphTexts = [...document.querySelectorAll("p")].map(element => element.textContent)

  expect(paragraphTexts).toContain(t("email.resetPassword.once"))
})
