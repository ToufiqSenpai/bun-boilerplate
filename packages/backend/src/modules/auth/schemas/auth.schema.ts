import { z } from "zod"

// GET /auth/setup (response)
export const authSetupResponseSchema = z
  .object({
    needed: z.boolean().describe("Whether initial setup is still required")
  })
  .describe("Setup status response")
