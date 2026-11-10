// Recreate dependency resolution without inheriting a stale node_modules tree.
// Uses only disposable files under this repository's ignored artifacts directory.
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd();
const destination = resolve(root, "artifacts/lock-resolution");
for (const folder of [".", "apps/web", "apps/mobile", "packages/domain"]) {
  const target = resolve(destination, folder);
  if (!target.startsWith(destination))
    throw new Error("Unexpected resolution path.");
  await mkdir(target, { recursive: true });
  await copyFile(
    resolve(root, folder, "package.json"),
    resolve(target, "package.json"),
  );
}
await copyFile(resolve(root, ".npmrc"), resolve(destination, ".npmrc"));
console.log(
  "Prepared disposable dependency resolver under artifacts/lock-resolution.",
);
