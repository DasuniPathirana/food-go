import { build } from "esbuild";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

/** Test-only browser bundle of actual encounter components and styles. */
export async function buildEncounterFixture() {
  const result = await build({ entryPoints: ["tests/fixtures/encounter-ui.tsx"], bundle: true, write: false, outdir: "artifacts/encounter-ui", platform: "browser", format: "iife",
    jsx: "automatic", tsconfig: "apps/web/tsconfig.json", define: { "process.env.NODE_ENV": '"production"' }, external: ["/fonts/*"],
    loader: { ".woff2": "dataurl", ".woff": "dataurl", ".ttf": "dataurl" },
    plugins: [{ name: "fixture-next-link", setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture-link" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture-link" }, () => ({ contents: 'import React from "react";export default function Link({href,prefetch,replace,scroll,...props}){return <a href={href} {...props}/>}', loader: "jsx", resolveDir: process.cwd() }));
    } }], logLevel: "silent" });
  return { javascript: result.outputFiles.find(file => file.path.endsWith(".js")).text,
    css: result.outputFiles.find(file => file.path.endsWith(".css")).text };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildEncounterFixture();
  if (process.argv[2] === "--output" && process.argv[3]) {
    const directory = resolve("artifacts"), target = resolve(process.argv[3]);
    if (!target.startsWith(directory + (process.platform === "win32" ? "\\" : "/")) || !target.endsWith(".json")) throw new Error("Fixture output must stay in artifacts.");
    await mkdir(directory, { recursive: true }); await writeFile(target, JSON.stringify(result));
  }
  console.log(JSON.stringify({ testFixture: true, javascriptBytes: Buffer.byteLength(result.javascript), cssBytes: Buffer.byteLength(result.css) }));
}
