import { DEFAULT_LOCALE, type Locale } from "@bun-boilerplate/i18n"
import { faker } from "@faker-js/faker"
import { JSDOM } from "jsdom"
import { renderToReadableStream } from "react-dom/server"

import { getTranslator } from "../../../common/translator.js"
import VerifyEmail, { type VerifyEmailProps, verifyEmailOptions } from "./verify-email.template.js"

function createProps(locale: Locale = DEFAULT_LOCALE): VerifyEmailProps {
  return {
    locale,
    name: faker.person.firstName(),
    email: faker.internet.email(),
    verificationUrl: `https://example.com/verify/${faker.string.uuid()}`,
    expiresInMinutes: faker.number.int({ min: 1, max: 120 })
  }
}

async function render(props: VerifyEmailProps): Promise<Document> {
  const stream = await renderToReadableStream(<VerifyEmail {...props} />)
  const html = await new Response(stream).text()

  return new JSDOM(html).window.document
}

describe("VerifyEmail", () => {
  test("renders with the Indonesian translations for the id locale", async () => {
    const props = createProps("id")
    const t = getTranslator("id")
    const document = await render(props)

    expect(document.documentElement.getAttribute("lang")).toBe("id")
    expect(document.querySelector("h1")?.textContent).toBe(t("email.verifyEmail.title"))
  })

  test("interpolates name, email, and expiry into the rendered paragraphs", async () => {
    const props = createProps()
    const t = getTranslator(props.locale)
    const document = await render(props)
    const paragraphTexts = [...document.querySelectorAll("p")].map(element => element.textContent)

    expect(paragraphTexts).toContain(t("email.verifyEmail.intro", { name: props.name, email: props.email }))
    expect(paragraphTexts).toContain(t("email.verifyEmail.expires", { expires: props.expiresInMinutes }))
  })

  test("links the verification url on the CTA button", async () => {
    const props = createProps()
    const document = await render(props)

    expect(document.querySelector(`a[href="${props.verificationUrl}"]`)).not.toBeNull()
  })
})

describe("verifyEmailOptions", () => {
  test("resolves the translated subject per locale", () => {
    const props = createProps("id")

    expect(verifyEmailOptions(props).subject).toBe(getTranslator("id")("email.verifyEmail.subject"))
  })

  test("derives the idempotency key from the email address, not the url", () => {
    const props = createProps()
    const expectedKey = `verify-email/${props.email.toLowerCase().trim()}`

    expect(verifyEmailOptions(props).idempotencyKey).toBe(expectedKey)
    expect(verifyEmailOptions({ ...props, verificationUrl: faker.internet.url() }).idempotencyKey).toBe(expectedKey)
  })

  test("targets the same template props for rendering", () => {
    const props = createProps()

    expect(verifyEmailOptions(props).react.type).toBe(VerifyEmail)
    expect(verifyEmailOptions(props).react.props).toEqual(props)
  })
})
