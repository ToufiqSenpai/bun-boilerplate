import { config } from "../config.js"
import { StorageKey } from "./storage-key.js"

describe("StorageKey", () => {
  describe("new StorageKey(collection, name)", () => {
    it("should create a key and expose collection/name", () => {
      const key = new StorageKey("avatars", "a.png")
      expect(key.collection).toBe("avatars")
      expect(key.name).toBe("a.png")
      expect(key.toString()).toBe("avatars/a.png")
    })

    it("should sanitize unsafe characters", () => {
      const key = new StorageKey("../avatars", "a/../../etc.png")
      expect(key.toString()).toBe("..avatars/a....etc.png")
    })

    it("should strip C0, DEL, and C1 control characters", () => {
      const key = new StorageKey("avatars", "a\u0007b\u007fc\u009fd.png")
      expect(key.toString()).toBe("avatars/abcd.png")
    })

    it("should throw when collection or name is empty", () => {
      expect(() => new StorageKey("", "a.png")).toThrow("Collection/name must be non-empty")
      expect(() => new StorageKey("avatars", "")).toThrow("Collection/name must be non-empty")
    })

    it("should throw when sanitized segment becomes empty", () => {
      expect(() => new StorageKey("/", "a.png")).toThrow("Collection/name becomes empty after sanitization")
      expect(() => new StorageKey("avatars", "/")).toThrow("Collection/name becomes empty after sanitization")
    })
  })

  describe("new StorageKey(key)", () => {
    it("should parse a full key", () => {
      const key = new StorageKey("avatars/a.png")
      expect(key.collection).toBe("avatars")
      expect(key.name).toBe("a.png")
      expect(key.toString()).toBe("avatars/a.png")
    })

    it("should sanitize segments from key", () => {
      expect(new StorageKey("ava\\tars/a.png").toString()).toBe("avatars/a.png")
      expect(new StorageKey("avatars", "a/../../etc.png").toString()).toBe("avatars/a....etc.png")
    })

    it("should throw for invalid key format", () => {
      expect(() => new StorageKey("")).toThrow("Too small: expected string to have >=1 characters")
      expect(() => new StorageKey("avatars")).toThrow('Key must be "collection/name"')
      expect(() => new StorageKey("a/b/c")).toThrow('Key must be "collection/name"')
      expect(() => new StorageKey("/a.png")).toThrow('Key must be "collection/name"')
      expect(() => new StorageKey("avatars/")).toThrow('Key must be "collection/name"')
    })
  })

  describe("toPublicUrl", () => {
    it("should resolve the key against the configured public host", () => {
      const url = new URL(new StorageKey("avatars/a.png").toPublicUrl())
      expect(url.origin).toBe(new URL(config.s3.publicBaseUrl).origin)
      expect(url.pathname.endsWith("/avatars/a.png")).toBe(true)
    })

    it("should percent-encode segments", () => {
      const url = new StorageKey("avatars", "a b.png").toPublicUrl()
      expect(url).toBe(`${config.s3.publicBaseUrl.replace(/\/$/, "")}/avatars/a%20b.png`)
    })
  })

  describe("equals", () => {
    it("should return true for equal keys", () => {
      expect(new StorageKey("a", "b").equals(new StorageKey("a/b"))).toBe(true)
    })

    it("should return false for different keys", () => {
      expect(new StorageKey("a", "b").equals(new StorageKey("a", "c"))).toBe(false)
    })
  })
})
