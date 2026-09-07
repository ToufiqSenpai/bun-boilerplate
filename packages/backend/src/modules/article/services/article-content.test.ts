import type { RichText } from "@bun-boilerplate/richtext"

import { collectUploadRefs, rewriteUploadRefs } from "./article-content.js"

describe("collectUploadRefs", () => {
  test("collects part names from image nodes at any depth, deduplicated", () => {
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "upload://hero" } },
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { src: "upload://hero" } },
            { type: "image", attrs: { src: "upload://inline-1" } }
          ]
        },
        { type: "text", text: "upload://not-an-image-src" }
      ]
    }

    expect(collectUploadRefs(doc)).toEqual(["hero", "inline-1"])
  })

  test("ignores stored keys, external urls, and non-string sources", () => {
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "articles/0190f3a2.png" } },
        { type: "image", attrs: { src: "https://cdn.example.org/pic.png" } },
        { type: "image", attrs: { src: 42 } },
        { type: "image" },
        { type: "paragraph" }
      ]
    }

    expect(collectUploadRefs(doc)).toEqual([])
  })

  test("keeps an empty upload reference so validation can reject it", () => {
    const doc: RichText = { type: "doc", content: [{ type: "image", attrs: { src: "upload://" } }] }

    expect(collectUploadRefs(doc)).toEqual([""])
  })
})

describe("rewriteUploadRefs", () => {
  test("replaces mapped references with stored keys and preserves sibling attributes", () => {
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "upload://hero", alt: "a" } },
        {
          type: "paragraph",
          content: [{ type: "image", attrs: { src: "upload://inline-1" } }]
        }
      ]
    }
    const keys = new Map([
      ["hero", "articles/0190f3a2/11111111-1111-7111-8111-111111111111.png"],
      ["inline-1", "articles/0190f3a2/22222222-2222-7222-8222-222222222222.jpg"]
    ])

    expect(rewriteUploadRefs(doc, keys)).toEqual({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "articles/0190f3a2/11111111-1111-7111-8111-111111111111.png", alt: "a" }
        },
        {
          type: "paragraph",
          content: [{ type: "image", attrs: { src: "articles/0190f3a2/22222222-2222-7222-8222-222222222222.jpg" } }]
        }
      ]
    })
  })

  test("leaves unmapped references, external urls, and stored keys untouched", () => {
    const doc: RichText = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "upload://missing" } },
        { type: "image", attrs: { src: "https://cdn.example.org/pic.png" } },
        { type: "image", attrs: { src: "articles/0190f3a2.png" } }
      ]
    }

    expect(rewriteUploadRefs(doc, new Map())).toEqual(doc)
  })

  test("does not mutate the input document", () => {
    const doc: RichText = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "upload://hero" } }]
    }
    const snapshot = structuredClone(doc)

    rewriteUploadRefs(doc, new Map([["hero", "articles/x.png"]]))

    expect(doc).toEqual(snapshot)
  })
})
