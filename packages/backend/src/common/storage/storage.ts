import type { Readable } from "stream"

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import * as Sentry from "@sentry/elysia"

import { config } from "../config.js"
import { logger } from "../logger.js"
import { StorageKey } from "./storage-key.js"

export interface FileHeaders {
  cacheControl?: string
  contentDisposition?: string
  contentEncoding?: string
  contentLanguage?: string
  contentType?: string
  contentLength?: number
  metadata?: Record<string, string>
}

export interface UploadFileParams {
  key: StorageKey
  stream: Readable
  headers?: FileHeaders
  signal?: AbortSignal | undefined
}

export interface CopyFileParams {
  source: StorageKey
  destination: StorageKey
  headers?: FileHeaders
}

export interface FileMetadata {
  key: string
  contentType?: string | undefined
  contentEncoding?: string | undefined
  contentLanguage?: string | undefined
  contentDisposition?: string | undefined
  createdAt?: Date | undefined
  lastModifiedAt?: Date | undefined
  size?: number | undefined
  metadata?: Record<string, string> | undefined
}

export class Storage {
  public constructor(private readonly s3: S3Client) {}

  public async upload({ key, stream, headers, signal }: UploadFileParams): Promise<FileMetadata> {
    const s3Key = key.toString()
    let bytesSent = 0
    stream.on("data", chunk => {
      bytesSent += chunk.length
    })

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: config.s3.bucket,
        Key: s3Key,
        Body: stream,
        CacheControl: headers?.cacheControl,
        ContentDisposition: headers?.contentDisposition,
        ContentEncoding: headers?.contentEncoding,
        ContentLanguage: headers?.contentLanguage,
        ContentType: headers?.contentType,
        ContentLength: headers?.contentLength,
        Metadata: headers?.metadata
      },
      leavePartsOnError: false
    })

    if (signal) {
      if (signal.aborted) await upload.abort()
      else signal.addEventListener("abort", () => void upload.abort(), { once: true })
    }

    await upload.done()
    return {
      key: s3Key,
      contentType: headers?.contentType,
      contentEncoding: headers?.contentEncoding,
      contentLanguage: headers?.contentLanguage,
      contentDisposition: headers?.contentDisposition,
      size: bytesSent,
      metadata: headers?.metadata,
      createdAt: new Date(),
      lastModifiedAt: new Date()
    }
  }

  public async getFile(key: StorageKey): Promise<Readable> {
    const result = await this.s3.send(
      new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: key.toString()
      })
    )
    // SAFETY: S3 streaming responses deliver object bodies as Node Readable streams
    return result.Body as Readable
  }

  public async getFileMetadata(key: StorageKey): Promise<FileMetadata> {
    const s3Key = key.toString()
    const head = await this.s3.send(
      new HeadObjectCommand({
        Bucket: config.s3.bucket,
        Key: s3Key
      })
    )

    return {
      key: s3Key,
      contentType: head.ContentType,
      contentEncoding: head.ContentEncoding,
      contentLanguage: head.ContentLanguage,
      contentDisposition: head.ContentDisposition,
      createdAt: undefined,
      lastModifiedAt: head.LastModified,
      size: head.ContentLength,
      metadata: head.Metadata
    }
  }

  public async copy({ source, destination, headers }: CopyFileParams): Promise<FileMetadata> {
    const sourceKey = source.toString()
    const destinationKey = destination.toString()

    await this.s3.send(
      new CopyObjectCommand({
        Bucket: config.s3.bucket,
        CopySource: `${config.s3.bucket}/${sourceKey}`,
        Key: destinationKey,
        CacheControl: headers?.cacheControl,
        ContentDisposition: headers?.contentDisposition,
        ContentEncoding: headers?.contentEncoding,
        ContentLanguage: headers?.contentLanguage,
        ContentType: headers?.contentType,
        Metadata: headers?.metadata,
        MetadataDirective: headers ? "REPLACE" : undefined
      })
    )

    const head = await this.s3.send(
      new HeadObjectCommand({
        Bucket: config.s3.bucket,
        Key: destinationKey
      })
    )

    return {
      key: destinationKey,
      contentType: headers?.contentType ?? head.ContentType,
      contentEncoding: headers?.contentEncoding ?? head.ContentEncoding,
      contentLanguage: headers?.contentLanguage ?? head.ContentLanguage,
      contentDisposition: headers?.contentDisposition ?? head.ContentDisposition,
      createdAt: undefined,
      lastModifiedAt: head.LastModified,
      size: head.ContentLength,
      metadata: headers?.metadata ?? head.Metadata
    }
  }

  public async list(collection: string): Promise<FileMetadata[]> {
    const prefix = `${StorageKey.sanitize(collection)}/`
    const objects: FileMetadata[] = []
    let continuationToken: string | undefined

    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: config.s3.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })
      )

      for (const obj of page.Contents ?? []) {
        if (!obj.Key) continue
        const head = await this.s3.send(
          new HeadObjectCommand({
            Bucket: config.s3.bucket,
            Key: obj.Key
          })
        )
        objects.push({
          key: obj.Key,
          contentType: head.ContentType,
          contentEncoding: head.ContentEncoding,
          contentLanguage: head.ContentLanguage,
          contentDisposition: head.ContentDisposition,
          createdAt: undefined,
          lastModifiedAt: head.LastModified,
          size: head.ContentLength,
          metadata: head.Metadata
        })
      }

      continuationToken = page.NextContinuationToken
    } while (continuationToken)

    return objects
  }

  public async delete(key: StorageKey | readonly StorageKey[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key]
    await Promise.all(
      keys.map(async item => {
        try {
          await this.s3.send(
            new DeleteObjectCommand({
              Bucket: config.s3.bucket,
              Key: item.toString()
            })
          )
        } catch (error) {
          logger.error({ key: item.toString(), err: error }, "Failed to delete stored object")
          Sentry.captureException(error, {
            level: "warning",
            tags: { component: "storage" },
            extra: { key: item.toString() }
          })
        }
      })
    )
  }
}

export const storage = new Storage(
  new S3Client({
    region: config.s3.region,
    endpoint: config.s3.endpoint,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey
    }
  })
)
