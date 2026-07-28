import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");

// Cloudflare's node:module compatibility layer requires an explicit file URL.
// The vinext runtime otherwise receives an undefined import.meta.url in Workers.
for (const root of [
  "dist/server/_next/static",
  "dist/standalone/dist/server/_next/static"
]) {
  const files = await readdir(root);
  for (const file of files.filter((name) => name.startsWith("rolldown-runtime-"))) {
    const target = path.join(root, file);
    const source = await readFile(target, "utf8");
    await writeFile(
      target,
      source.replace(
        /([A-Za-z_$][\w$]*)\(import\.meta\.url\)/,
        "(()=>{throw Error('Dynamic require unavailable')})"
      )
    );
  }
}
