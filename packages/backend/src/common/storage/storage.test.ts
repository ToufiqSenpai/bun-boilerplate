import { Readable } from "stream"

import {
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  UploadPartCommand,
  type S3Client
} from "@aws-sdk/client-s3"
import { mockDeep, type MockProxy } from "vitest-mock-extended"

import { config } from "../config.js"
import { StorageKey } from "./storage-key.js"
import { Storage } from "./storage.js"

type AnyCommand =
  | CopyObjectCommand
  | CreateMultipartUploadCommand
  | DeleteObjectCommand
  | HeadObjectCommand
  | ListObjectsV2Command
  | PutObjectCommand
  | UploadPartCommand

function commandAt<T extends AnyCommand>(
  mockS3: MockProxy<S3Client>,
  index: number,
  ctor: new (...args: never[]) => T
): T {
  const [command] = mockS3.send.mock.calls[index] ?? []
  expect(command).toBeInstanceOf(ctor)
  // SAFETY: instanceof has verified the concrete S3 command class before narrowing
  return command as T
}

function endlessStream(): Readable {
  return new Readable({
    read() {
      setTimeout(() => {
        if (!this.destroyed) this.push(Buffer.from("x".repeat(64)))
      }, 1)
    }
  })
}

function stubS3Upload(mockS3: MockProxy<S3Client>): void {
  const endpoint = mockS3.config.endpoint
  if (endpoint) {
    vi.mocked(endpoint).mockResolvedValue({
      hostname: "test.s3.amazonaws.com",
      protocol: "https:",
      port: 443,
      path: "/"
    })
  }
  mockS3.send.mockImplementation(async command => {
    if (command instanceof CreateMultipartUploadCommand) return { UploadId: "upload-id" }
    if (command instanceof UploadPartCommand) return { ETag: `"part-${command.input.PartNumber}"` }
    return { ETag: "put-etag" }
  })
}

describe("Storage", () => {
  let mockS3: MockProxy<S3Client>
  let storage: Storage

  beforeEach(() => {
    mockS3 = mockDeep<S3Client>()
    storage = new Storage(mockS3)
  })

  describe("upload", () => {
    it("should upload and return FileMetadata", async () => {
      stubS3Upload(mockS3)
      const stream = Readable.from(["hello"])
      const result = await storage.upload({ key: new StorageKey("avatars", "a.png"), stream })

      const put = commandAt(mockS3, 0, PutObjectCommand)
      expect(put.input.Bucket).toBe(config.s3.bucket)
      expect(put.input.Key).toBe("avatars/a.png")
      expect(result.key).toBe("avatars/a.png")
      expect(result.size).toBe(5)
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.lastModifiedAt).toBeInstanceOf(Date)
    })

    it("should include headers when provided", async () => {
      stubS3Upload(mockS3)
      const stream = Readable.from(["hello"])
      const result = await storage.upload({
        key: new StorageKey("avatars", "a.png"),
        stream,
        headers: {
          contentType: "image/png",
          cacheControl: "public, max-age=3600",
          contentDisposition: 'inline; filename="a.png"',
          contentEncoding: "gzip",
          contentLanguage: "en",
          metadata: { foo: "bar" }
        }
      })

      const put = commandAt(mockS3, 0, PutObjectCommand)
      expect(put.input.ContentType).toBe("image/png")
      expect(put.input.CacheControl).toBe("public, max-age=3600")
      expect(put.input.ContentDisposition).toBe('inline; filename="a.png"')
      expect(put.input.ContentEncoding).toBe("gzip")
      expect(put.input.ContentLanguage).toBe("en")
      expect(put.input.Metadata).toEqual({ foo: "bar" })
      expect(result.contentType).toBe("image/png")
      expect(result.metadata).toEqual({ foo: "bar" })
    })

    it("should report the number of bytes sent through the stream", async () => {
      stubS3Upload(mockS3)
      const stream = Readable.from(["hello", "world"])
      const result = await storage.upload({ key: new StorageKey("avatars", "a.txt"), stream })

      expect(result.size).toBe(10)
    })

    it("should abort upload when signal is aborted", async () => {
      stubS3Upload(mockS3)
      const abort = new AbortController()
      const stream = endlessStream()

      const promise = storage.upload({ key: new StorageKey("avatars", "a.png"), stream, signal: abort.signal })
      await new Promise(resolve => setImmediate(resolve))
      abort.abort()
      await expect(promise).rejects.toThrow("Upload aborted")
      stream.destroy()
    })

    it("should abort immediately if signal already aborted", async () => {
      stubS3Upload(mockS3)
      const abort = new AbortController()
      abort.abort()
      const stream = Readable.from(["hello"])

      await expect(
        storage.upload({ key: new StorageKey("avatars", "a.png"), stream, signal: abort.signal })
      ).rejects.toThrow("Upload aborted")
      expect(mockS3.send).not.toHaveBeenCalled()
    })
  })

  describe("getFileMetadata", () => {
    it("should return metadata from HeadObject only", async () => {
      const lastModified = new Date("2026-01-01T00:00:00Z")
      mockS3.send.mockImplementation(async () => ({
        ContentLength: 123,
        ContentType: "image/png",
        ContentEncoding: "gzip",
        ContentLanguage: "en",
        ContentDisposition: "inline",
        LastModified: lastModified,
        Metadata: { foo: "bar" }
      }))

      const result = await storage.getFileMetadata(new StorageKey("avatars", "a.png"))

      expect(mockS3.send).toHaveBeenCalledTimes(1)
      expect(commandAt(mockS3, 0, HeadObjectCommand).input.Key).toBe("avatars/a.png")
      expect(result).toEqual({
        key: "avatars/a.png",
        contentType: "image/png",
        contentEncoding: "gzip",
        contentLanguage: "en",
        contentDisposition: "inline",
        createdAt: undefined,
        lastModifiedAt: lastModified,
        size: 123,
        metadata: { foo: "bar" }
      })
    })
  })

  describe("list", () => {
    it("should list all objects across pages", async () => {
      const lastModified = new Date("2026-01-01T00:00:00Z")
      mockS3.send
        .mockImplementationOnce(async () => ({
          Contents: [{ Key: "avatars/a.png", Size: 1 }],
          NextContinuationToken: "token-1"
        }))
        .mockImplementationOnce(async () => ({
          ContentLength: 1,
          ContentType: "image/png",
          LastModified: lastModified,
          Metadata: { a: "1" }
        }))
        .mockImplementationOnce(async () => ({
          Contents: [{ Key: "avatars/b.png", Size: 2 }],
          NextContinuationToken: undefined
        }))
        .mockImplementationOnce(async () => ({
          ContentLength: 2,
          ContentType: "image/png",
          LastModified: lastModified,
          Metadata: { b: "2" }
        }))

      const result = await storage.list("avatars")

      expect(mockS3.send).toHaveBeenCalledTimes(4)
      expect(result).toEqual([
        {
          key: "avatars/a.png",
          contentType: "image/png",
          contentEncoding: undefined,
          contentLanguage: undefined,
          contentDisposition: undefined,
          createdAt: undefined,
          lastModifiedAt: lastModified,
          size: 1,
          metadata: { a: "1" }
        },
        {
          key: "avatars/b.png",
          contentType: "image/png",
          contentEncoding: undefined,
          contentLanguage: undefined,
          contentDisposition: undefined,
          createdAt: undefined,
          lastModifiedAt: lastModified,
          size: 2,
          metadata: { b: "2" }
        }
      ])
    })

    it("should skip objects without a key", async () => {
      mockS3.send.mockImplementation(async () => ({
        Contents: [{ Size: 1 }],
        NextContinuationToken: undefined
      }))

      const result = await storage.list("avatars")

      expect(result).toEqual([])
    })
  })

  describe("delete", () => {
    it("should delete the object with the sanitized key", async () => {
      mockS3.send.mockImplementation(async () => ({}))

      await storage.delete(new StorageKey("avatars", "../evil.png"))

      expect(commandAt(mockS3, 0, DeleteObjectCommand).input.Key).toBe("avatars/..evil.png")
    })
  })

  describe("copy", () => {
    it("should copy an object and return metadata of the destination", async () => {
      const lastModified = new Date("2026-01-01T00:00:00Z")
      mockS3.send
        .mockImplementationOnce(async () => ({}))
        .mockImplementationOnce(async () => ({
          ContentLength: 123,
          ContentType: "image/png",
          ContentEncoding: "gzip",
          ContentLanguage: "en",
          ContentDisposition: "inline",
          LastModified: lastModified,
          Metadata: { foo: "bar" }
        }))

      const result = await storage.copy({
        source: new StorageKey("avatars", "a.png"),
        destination: new StorageKey("backups", "a.png")
      })

      expect(mockS3.send).toHaveBeenCalledTimes(2)
      const copy = commandAt(mockS3, 0, CopyObjectCommand)
      expect(copy.input.CopySource).toBe(`${config.s3.bucket}/avatars/a.png`)
      expect(copy.input.Key).toBe("backups/a.png")
      expect(result).toEqual({
        key: "backups/a.png",
        contentType: "image/png",
        contentEncoding: "gzip",
        contentLanguage: "en",
        contentDisposition: "inline",
        createdAt: undefined,
        lastModifiedAt: lastModified,
        size: 123,
        metadata: { foo: "bar" }
      })
    })

    it("should apply headers with MetadataDirective REPLACE when provided", async () => {
      mockS3.send
        .mockImplementationOnce(async () => ({}))
        .mockImplementationOnce(async () => ({
          ContentLength: 10,
          ContentType: "image/webp",
          LastModified: new Date("2026-01-01T00:00:00Z"),
          Metadata: { foo: "bar" }
        }))

      const result = await storage.copy({
        source: new StorageKey("avatars", "a.png"),
        destination: new StorageKey("backups", "a.png"),
        headers: {
          contentType: "image/webp",
          cacheControl: "public, max-age=3600",
          metadata: { new: "meta" }
        }
      })

      const copy = commandAt(mockS3, 0, CopyObjectCommand)
      expect(copy.input.MetadataDirective).toBe("REPLACE")
      expect(copy.input.ContentType).toBe("image/webp")
      expect(copy.input.CacheControl).toBe("public, max-age=3600")
      expect(copy.input.Metadata).toEqual({ new: "meta" })
      expect(result.contentType).toBe("image/webp")
      expect(result.metadata).toEqual({ new: "meta" })
    })

    it("should omit MetadataDirective when no headers provided", async () => {
      mockS3.send.mockImplementationOnce(async () => ({})).mockImplementationOnce(async () => ({ ContentLength: 1 }))

      await storage.copy({
        source: new StorageKey("avatars", "a.png"),
        destination: new StorageKey("backups", "a.png")
      })

      expect(commandAt(mockS3, 0, CopyObjectCommand).input.MetadataDirective).toBeUndefined()
    })

    it("should use sanitized keys for source and destination", async () => {
      mockS3.send.mockImplementationOnce(async () => ({})).mockImplementationOnce(async () => ({ ContentLength: 1 }))

      await storage.copy({
        source: new StorageKey("avatars", "../evil.png"),
        destination: new StorageKey("backups", "a/../../etc.png")
      })

      const copy = commandAt(mockS3, 0, CopyObjectCommand)
      expect(copy.input.CopySource).toBe(`${config.s3.bucket}/avatars/..evil.png`)
      expect(copy.input.Key).toBe("backups/a....etc.png")
    })
  })

  describe("key sanitization", () => {
    it("should strip unsafe characters from collection and name", async () => {
      mockS3.send.mockImplementation(async () => ({ ContentLength: 1 }))

      await storage.getFileMetadata(new StorageKey("../avatars", "a/../../etc.png"))

      expect(commandAt(mockS3, 0, HeadObjectCommand).input.Key).toBe("..avatars/a....etc.png")
    })
  })
})
