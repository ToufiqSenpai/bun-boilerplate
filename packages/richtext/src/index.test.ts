import { type RichText, richTextSchema } from "./index.js"

const validate = (doc: RichText) => {
  richTextSchema.nodeFromJSON(doc).check()
}

describe("richTextSchema", () => {
  test("accepts a valid rich text document", () => {
    expect(() => {
      validate({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "hello", marks: [{ type: "bold" }] }] },
          { type: "image", attrs: { src: "upload://cover.png" } }
        ]
      })
    }).not.toThrow()
  })

  test("rejects unknown node types", () => {
    expect(() => {
      validate({ type: "doc", content: [{ type: "not-a-real-node" }] })
    }).toThrow(/node type/i)
  })

  test("rejects documents violating the content spec", () => {
    expect(() => {
      validate({ type: "doc" })
    }).toThrow(/invalid content/i)
    expect(() => {
      validate({ type: "doc", content: [{ type: "text", text: "inline at top level" }] })
    }).toThrow(/invalid content/i)
  })

  test("image nodes do not require a src attribute by default", () => {
    expect(() => {
      validate({ type: "doc", content: [{ type: "image" }] })
    }).not.toThrow()
  })
})
