import { existsSync } from "fs"
import { join } from "path"

const serverDir = join(import.meta.dirname, "../.output/server")
const outfile = join(import.meta.dirname, "../dist/web")

if (!existsSync(join(serverDir, "index.mjs"))) {
  console.error("Missing .output — run `bun run build` first.")
  process.exit(1)
}

const result = Bun.spawnSync(["bun", "build", "--compile", "--sourcemap", "./index.mjs", "--outfile", outfile], {
  cwd: serverDir,
  stdout: "inherit",
  stderr: "inherit"
})

if (result.exitCode !== 0) {
  console.error("bun build --compile failed")
  process.exit(result.exitCode)
}

console.log(`Standalone executable ready: ${outfile}${process.platform === "win32" ? ".exe" : ""}`)
