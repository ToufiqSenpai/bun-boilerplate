import { existsSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"

const serverDir = join(import.meta.dirname, "../.output/server")
const entrySrc = join(serverDir, "index.mjs")
const entryPatched = join(serverDir, "index.exe.mjs")
const publicDir = join(import.meta.dirname, "../.output/public")
const outfile = join(import.meta.dirname, "../dist/web")

if (!existsSync(entrySrc) || !existsSync(publicDir)) {
  console.error("Missing .output — run `bun run build` first.")
  process.exit(1)
}

const source = readFileSync(entrySrc, "utf8")
const patchedCount = source.split('"../public/').length - 1
if (patchedCount === 0) {
  console.error('Expected "../public/" asset paths in .output/server/index.mjs — aborting.')
  process.exit(1)
}
writeFileSync(entryPatched, source.replaceAll('"../public/', '"./public/'), "utf8")

const result = Bun.spawnSync(
  ["bun", "build", "--compile", "--sourcemap", "--asset", "../public", "./index.exe.mjs", "--outfile", outfile],
  { cwd: serverDir, stdout: "inherit", stderr: "inherit" }
)

rmSync(entryPatched, { force: true })

if (result.exitCode !== 0) {
  console.error("bun build --compile failed")
  process.exit(result.exitCode)
}

console.log(`Standalone executable ready: ${outfile}.exe (${patchedCount} asset paths patched)`)
