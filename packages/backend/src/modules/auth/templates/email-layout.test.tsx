import { faker } from "@faker-js/faker"
import { JSDOM } from "jsdom"
import { renderToReadableStream } from "react-dom/server"

import { ActionEmail, EmailLayout } from "./email-layout.js"

interface ActionEmailStrings {
  preview: string
  heading: string
  intro: string
  expires: string
  ctaLabel: string
  url: string
  footnotes: string[]
  fallbackLabel: string
}

function createStrings(): ActionEmailStrings {
  return {
    preview: faker.lorem.sentence(),
    heading: faker.lorem.words(3),
    intro: faker.lorem.sentence(),
    expires: faker.lorem.sentence(),
    ctaLabel: faker.lorem.words(2),
    url: faker.internet.url({ appendSlash: false }) + `/${faker.string.uuid()}`,
    footnotes: [faker.lorem.sentence(), faker.lorem.sentence()],
    fallbackLabel: faker.lorem.sentence()
  }
}

async function render(strings: ActionEmailStrings, locale: "en" | "id" = "en"): Promise<Document> {
  const stream = await renderToReadableStream(
    <EmailLayout locale={locale} preview={strings.preview}>
      <ActionEmail {...strings} />
    </EmailLayout>
  )
  const html = await new Response(stream).text()

  return new JSDOM(html).window.document
}

describe("EmailLayout", () => {
  test("sets lang and dir on the html element", async () => {
    const document = await render(createStrings(), "id")

    expect(document.documentElement.getAttribute("lang")).toBe("id")
    expect(document.documentElement.getAttribute("dir")).toBe("ltr")
  })

  test("exposes the preview text in the title element", async () => {
    const strings = createStrings()
    const document = await render(strings)

    expect(document.querySelector("title")?.textContent).toBe(strings.preview)
  })
})

describe("ActionEmail", () => {
  test("renders a single h1 heading with the heading text", async () => {
    const strings = createStrings()
    const document = await render(strings)
    const headings = document.querySelectorAll("h1")

    expect(headings).toHaveLength(1)
    expect(headings[0]?.textContent).toBe(strings.heading)
  })

  test("renders intro and expires paragraphs in order", async () => {
    const strings = createStrings()
    const document = await render(strings)
    const paragraphTexts = [...document.querySelectorAll("p")].map(element => element.textContent)

    expect(paragraphTexts).toContain(strings.intro)
    expect(paragraphTexts).toContain(strings.expires)
  })

  test("links the url on the CTA button and the fallback link", async () => {
    const strings = createStrings()
    const document = await render(strings)
    const links = [...document.querySelectorAll(`a[href="${strings.url}"]`)]

    expect(links).toHaveLength(2)
    expect(links[0]?.textContent).toBe(strings.ctaLabel)
    expect(links[1]?.textContent).toBe(strings.url)
  })

  test("renders every footnote plus the fallback label", async () => {
    const strings = createStrings()
    const document = await render(strings)
    const paragraphTexts = [...document.querySelectorAll("p")].map(element => element.textContent)

    for (const footnote of strings.footnotes) {
      expect(paragraphTexts).toContain(footnote)
    }
    expect(paragraphTexts).toContain(strings.fallbackLabel)
  })
})
