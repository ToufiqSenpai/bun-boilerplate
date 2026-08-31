import type { Locale } from "@bun-boilerplate/i18n"
import { faker } from "@faker-js/faker"
import { JSDOM } from "jsdom"
import type { ReactElement } from "react"
import { renderToReadableStream } from "react-dom/server"

import { getTranslator } from "../../../common/i18n.js"
import type { ResetPasswordProps } from "./reset-password.template.js"
import { ResetPasswordTemplate } from "./reset-password.template.js"

function createProps(): ResetPasswordProps {
  return {
    name: faker.person.firstName(),
    email: faker.internet.email(),
    resetUrl: `https://example.com/reset/${faker.string.uuid()}`,
    expiresInMinutes: faker.number.int({ min: 1, max: 120 })
  }
}

async function renderTemplate(locale: Locale, props: ResetPasswordProps): Promise<Document> {
  const node = await new ResetPasswordTemplate(locale, props).getTemplate()
  // SAFETY: EmailTemplate.getTemplate always returns an <Html> React element
  const stream = await renderToReadableStream(node as ReactElement)
  const html = await new Response(stream).text()

  return new JSDOM(html).window.document
}

function texts(document: Document, selector: string): string[] {
  return [...document.querySelectorAll(selector)].map(element => element.textContent)
}

describe("ResetPasswordTemplate", () => {
  describe("subjectKey", () => {
    test("returns the reset password subject key", () => {
      const template = new ResetPasswordTemplate("en", createProps())

      expect(template.subjectKey()).toBe("email.resetPassword.subject")
    })
  })

  describe("getEntityId", () => {
    test("returns the reset url", () => {
      const props = createProps()
      const template = new ResetPasswordTemplate("en", props)

      expect(template.getEntityId()).toBe(props.resetUrl)
    })
  })

  describe("getSubject", () => {
    test("resolves the translated subject for the en locale", async () => {
      const template = new ResetPasswordTemplate("en", createProps())
      const subject = await template.getSubject()

      expect(subject).toBe(getTranslator("en")("email.resetPassword.subject"))
      expect(subject).not.toBe("email.resetPassword.subject")
    })

    test("resolves the translated subject for the id locale", async () => {
      const template = new ResetPasswordTemplate("id", createProps())
      const subject = await template.getSubject()

      expect(subject).toBe(getTranslator("id")("email.resetPassword.subject"))
      expect(subject).not.toBe("email.resetPassword.subject")
    })
  })

  describe("getTemplate", () => {
    test("sets lang and dir on the html element", async () => {
      const document = await renderTemplate("en", createProps())

      expect(document.documentElement.getAttribute("lang")).toBe("en")
      expect(document.documentElement.getAttribute("dir")).toBe("ltr")
    })

    test("exposes the preview text in the title element", async () => {
      const document = await renderTemplate("en", createProps())
      const t = getTranslator("en")

      expect(document.querySelector("title")?.textContent).toBe(t("email.resetPassword.preview"))
    })

    test("has a single h1 heading with the translated title", async () => {
      const t = getTranslator("en")
      const document = await renderTemplate("en", createProps())
      const headings = document.querySelectorAll("h1")

      expect(headings).toHaveLength(1)
      expect(headings[0]?.textContent).toBe(t("email.resetPassword.title"))
    })

    test("interpolates name and email into the intro paragraph", async () => {
      const props = createProps()
      const t = getTranslator("en")
      const document = await renderTemplate("en", props)

      expect(texts(document, "p")).toContain(t("email.resetPassword.intro", { name: props.name, email: props.email }))
    })

    test("interpolates the expiry minutes into the expires paragraph", async () => {
      const props = createProps()
      const t = getTranslator("en")
      const document = await renderTemplate("en", props)

      expect(texts(document, "p")).toContain(t("email.resetPassword.expires", { expires: props.expiresInMinutes }))
    })

    test("links the reset url on the CTA button and the fallback link", async () => {
      const props = createProps()
      const t = getTranslator("en")
      const document = await renderTemplate("en", props)
      const links = [...document.querySelectorAll(`a[href="${props.resetUrl}"]`)]

      expect(links).toHaveLength(2)
      expect(links[0]?.textContent).toBe(t("email.resetPassword.cta"))
      expect(links[1]?.textContent).toBe(props.resetUrl)
    })

    test("uses the Indonesian translations and locale attributes for the id locale", async () => {
      const t = getTranslator("id")
      const document = await renderTemplate("id", createProps())

      expect(document.documentElement.getAttribute("lang")).toBe("id")
      expect(document.querySelector("h1")?.textContent).toBe(t("email.resetPassword.title"))
      expect(t("email.resetPassword.title")).not.toBe("email.resetPassword.title")
    })
  })
})
