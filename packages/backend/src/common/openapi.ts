import type { ElysiaOpenAPIConfig } from "@elysiajs/openapi"

export type OpenApiDocumentation = NonNullable<ElysiaOpenAPIConfig["documentation"]>

export type OpenApiTag = NonNullable<OpenApiDocumentation["tags"]>[number]
