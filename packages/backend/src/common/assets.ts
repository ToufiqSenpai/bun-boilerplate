import { join } from "path"

export const assetsDir = Bun.isStandaloneExecutable ? import.meta.dirname : join(import.meta.dirname, "../..")
