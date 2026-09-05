import { DEFAULT_LOCALE, type Locale } from "@bun-boilerplate/i18n"
import { faker } from "@faker-js/faker"
import { JSDOM } from "jsdom"
import { renderToReadableStream } from "react-dom/server"

import { getTranslator } from "../../../common/translator.js"
import ResetPassword, { type ResetPasswordProps, resetPasswordOptions } from "./reset-password.template.js"

function createProps(locale: Locale = DEFAULT_LOCALE): ResetPasswordProps {
  return {
    locale,
    name: faker.person.firstName(),
    email: faker.internet.email(),
    resetUrl: `https://example.com/reset/${faker.string.uuid()}`,
    expiresInMinutes: faker.number.int({ min: 1, max: 120 })
  }
}

async function render(props: ResetPasswordProps): Promise<Document> {
  const stream = await renderToReadableStream(<ResetPassword {...props} />)
  const html = await new Response(stream).text()

  return new JSDOM(html).window.document
}

describe("ResetPassword", () => {
  test("renders with the Indonesian translations for the id locale", async () => {
    const props = createProps("id")
    const t = getTranslator("id")
    const document = await render(props)

    expect(document.documentElement.getAttribute("lang")).toBe("id")
    expect(document.querySelector("h1")?.textContent).toBe(t("email.resetPassword.title"))
  })

  test("interpolates name, email, and expiry into the rendered paragraphs", async () => {
    const props = createProps()
    const t = getTranslator(props.locale)
    const document = await render(props)
    const paragraphTexts = [...document.querySelectorAll("p")].map(element => element.textContent)

    expect(paragraphTexts).toContain(t("email.resetPassword.intro", { name: props.name, email: props.email }))
    expect(paragraphTexts).toContain(t("email.resetPassword.expires", { expires: props.expiresInMinutes }))
  })

  test("includes the single-use warning as a footnote", async () => {
    const props = createProps()
    const t = getTranslator(props.locale)
    const document = await render(props)
    const paragraphTexts = [...document.querySelectorAll("p")].map(element => element.textContent)

    expect(paragraphTexts).toContain(t("email.resetPassword.once"))
  })

  test("links the reset url on the CTA button", async () => {
    const props = createProps()
    const document = await render(props)

    expect(document.querySelector(`a[href="${props.resetUrl}"]`)).not.toBeNull()
  })
})

describe("resetPasswordOptions", () => {
  test("resolves the translated subject per locale", () => {
    const props = createProps("id")

    expect(resetPasswordOptions(props).subject).toBe(getTranslator("id")("email.resetPassword.subject"))
  })

  test("derives the idempotency key from the email address, not the url", () => {
    const props = createProps()
    const expectedKey = `reset-password/${props.email.toLowerCase().trim()}`

    expect(resetPasswordOptions(props).idempotencyKey).toBe(expectedKey)
    expect(resetPasswordOptions({ ...props, resetUrl: faker.internet.url() }).idempotencyKey).toBe(expectedKey)
  })
})
