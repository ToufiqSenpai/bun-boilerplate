# NodeImage stored as a TipTap image node with a key-only `attrs.src`

Date: 2026-09-07

## Status

Accepted

## Context

`ArticleContent` is a TipTap JSON document stored as-is with only envelope validation, and `CONTEXT.md` defines a `NodeImage` as "an image embedded in ArticleContent by reference to its stored key, never to a host; the key is resolved to its host at query time". Neither the glossary nor issue #45 pinned the concrete JSON shape, yet both the read path (list/get URL resolution) and the write path (create/replace upload-reference rewriting) must agree on it, and it is effectively unchangeable once documents are in storage.

Alternatives considered:

- **Store the full URL in `src`**: contradicts the glossary ("never to a host") and breaks every stored document when the public host (CDN, R2 custom domain) changes.
- **Custom attribute names** (e.g. `attrs.key`, `data-storage-key`): explicit, but fights the stock TipTap Image extension every editor fork would otherwise use for free, and the editor is out of scope here.
- **A separate media-block node type alongside images**: doubles the node taxonomy for no behavioral gain, since only the `src` value differs.

## Decision

A `NodeImage` is a node serialized by the default TipTap Image extension:

```json
{ "type": "image", "attrs": { "src": "articles/0190f3a2-….png", "alt": "…", "title": "…" } }
```

- Nodes are recognized by `type === "image"` only; their `attrs.src` string is the storage key. Other attributes are never touched.
- The stored `src` holds a `StorageKey`-shaped string (`collection/name`, no leading slash, no host). At query time the server rewrites it to `${config.s3.publicBaseUrl}/${key}` via URL joining; `config.s3.publicBaseUrl` is required configuration.
- `src` values that are already absolute `http(s)` URLs pass through unchanged (external images).
- On write requests only, `src` may instead be an `upload://<part-name>` reference bound to a multipart file part; the server uploads the part and rewrites the reference to the stored key before persisting. An `upload://` reference must never reach storage; if one is found in a stored document, readers leave it as-is rather than crashing.
- Resolution and rewriting are recursive over `content` arrays of arbitrary nesting; non-image nodes and primitives are passed through untouched.

## Consequences

- Host changes (bucket migration, new CDN domain) require no document rewrites — only configuration.
- The server trusts `type: "image"` nodes; deep node whitelisting remains out of scope per #45, so an editor emitting unusual payloads is the caller's problem until sanitization lands.
- Clients fetch images by prefixing keys themselves only as a last resort: every read endpoint serves fully resolved URLs.

## References

- Spec: GitHub issues #45 and #47 (`ToufiqSenpai/bun-boilerplate`)
- Glossary: `CONTEXT.md` (`ArticleContent`, `NodeImage`, `CoverImage`, `Locale`)
- Related ADR: 0001 (single `:identifier` route pattern reused for Articles in #48)
