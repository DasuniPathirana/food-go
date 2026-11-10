import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// These checks enforce source conventions only. They do not execute PostgreSQL
// policies, authenticate users, inspect deployed headers or constitute an audit.
const root = fileURLToPath(new URL("../", import.meta.url));
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  ".next",
  ".npm-cache",
  ".expo",
  ".turbo",
  "artifacts",
  "dist",
  "coverage",
]);
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".sql",
  ".yml",
  ".yaml",
  ".md",
  ".css",
  ".toml",
]);
const source = (path) => readFileSync(join(root, path), "utf8");

function sourceFiles(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (lstatSync(path).isSymbolicLink()) return [];
    if (entry.isDirectory())
      return ignoredDirectories.has(entry.name) ? [] : sourceFiles(path);
    // Never read local environment secrets. Only explicit example templates qualify.
    if (entry.name.startsWith(".env"))
      return entry.name === ".env.example" ? [path] : [];
    return textExtensions.has(extname(entry.name)) ||
      [".gitignore", ".npmrc"].includes(entry.name)
      ? [path]
      : [];
  });
}

test("static convention: local environment files and private key files are not tracked", () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const forbidden = tracked.filter((path) => {
    const name = path.split("/").at(-1);
    return (
      (name.startsWith(".env") && name !== ".env.example") ||
      /\.(?:pem|key|p12|keystore|jks|mobileprovision)$/i.test(name)
    );
  });
  assert.deepEqual(
    forbidden,
    [],
    "Remove private credential files from tracked source and rotate any exposed credentials.",
  );
  assert.match(source(".gitignore"), /^\.env$/m);
  assert.match(source(".gitignore"), /^\.env\.\*$/m);
});

test("static convention: source does not contain recognisable secret material or public privileged keys", () => {
  const failures = [];
  for (const path of sourceFiles()) {
    const text = readFileSync(path, "utf8");
    const hasRecognisableSecret =
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
      /\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(text) ||
      /\bsb_secret_[A-Za-z0-9_-]{20,}\b/.test(text);
    const hasPublicPrivilegedName =
      /\b(?:NEXT_PUBLIC_|EXPO_PUBLIC_)[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*\b/.test(
        text,
      );
    const hasLegacyServiceToken = [
      ...text.matchAll(
        /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      ),
    ].some(([token]) => {
      try {
        return (
          JSON.parse(
            Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
          ).role === "service_role"
        );
      } catch {
        return false;
      }
    });
    if (
      hasRecognisableSecret ||
      hasPublicPrivilegedName ||
      hasLegacyServiceToken
    )
      failures.push(relative(root, path));
  }
  // Do not include matched token values in assertion output.
  assert.deepEqual(
    failures,
    [],
    "Review the listed files for privileged credentials. This is not a complete secret scanner.",
  );
});

test("static convention: every foundation table declares row-level security", () => {
  const migration = source(
    "supabase/migrations/202611100001_food_go_foundation.sql",
  );
  const tables = [
    ...migration.matchAll(/create table public\.(\w+)\s*\(/g),
  ].map((match) => match[1]);
  assert.ok(tables.length >= 10, "Expected the foundation tables.");
  for (const table of tables) {
    assert.match(
      migration,
      new RegExp(
        `alter table public\\.${table} enable row level security;`,
        "i",
      ),
      `${table} must explicitly enable RLS.`,
    );
  }
});

test("static convention: table access is revoked from PUBLIC before explicit client grants", () => {
  const migration = source(
    "supabase/migrations/202611100001_food_go_foundation.sql",
  ).replace(/--[^\n]*/g, "");
  const reset = migration.match(
    /revoke all on table\s+((?:public\.\w+[\s,]*)+)\s+from public, anon, authenticated;/i,
  );
  assert.ok(
    reset,
    "Reset PUBLIC and client privileges explicitly before granting intended access.",
  );
  const createdTables = [
    ...migration.matchAll(/create table public\.(\w+)\s*\(/g),
  ].map((match) => `public.${match[1]}`);
  const revokedTables = reset[1].split(",").map((name) => name.trim());
  for (const table of createdTables)
    assert.ok(
      revokedTables.includes(table),
      `${table} must be included in the privilege reset.`,
    );
});

test("static convention: anonymous grants expose only the intended read-only catalogue", () => {
  const migration = source(
    "supabase/migrations/202611100001_food_go_foundation.sql",
  ).replace(/--[^\n]*/g, "");
  const grants = [
    ...migration.matchAll(
      /grant\s+((?:select|insert|update|delete|truncate|references|trigger|maintain|all(?:\s+privileges)?)(?:\s*\([^;)]*\))?)\s+on\s+(?:table\s+)?((?:public\.\w+[\s,]*)+)\s+to\s+([^;]+);/gi,
    ),
  ];
  const allowed = new Set([
    "public.venues",
    "public.canonical_foods",
    "public.venue_dishes",
  ]);
  let publicGrantCount = 0;
  for (const [, permission, tableNames, roleNames] of grants) {
    const roles = roleNames.split(",").map((role) => role.trim().toLowerCase());
    if (!roles.includes("anon") && !roles.includes("public")) continue;
    publicGrantCount += 1;
    assert.equal(
      permission.trim().toLowerCase(),
      "select",
      "Anonymous table permissions must be read-only.",
    );
    for (const table of tableNames.split(",").map((name) => name.trim()))
      assert.ok(
        allowed.has(table),
        `${table} is not anonymous catalogue data.`,
      );
  }
  assert.ok(
    publicGrantCount > 0,
    "Expected explicit catalogue read permissions.",
  );
});

test("static convention: database-owned mutations are not granted to authenticated clients", () => {
  const migration = source(
    "supabase/migrations/202611100001_food_go_foundation.sql",
  ).replace(/--[^\n]*/g, "");
  const grants = [
    ...migration.matchAll(
      /grant\s+((?:select|insert|update|delete|truncate|references|trigger|maintain|all(?:\s+privileges)?)(?:\s*\([^;)]*\))?)\s+on\s+(?:table\s+)?((?:public\.\w+[\s,]*)+)\s+to\s+([^;]+);/gi,
    ),
  ];
  for (const [, permission, tableNames, roleNames] of grants) {
    if (
      !roleNames
        .split(",")
        .some((role) => role.trim().toLowerCase() === "authenticated")
    )
      continue;
    const tables = tableNames.split(",").map((name) => name.trim());
    if (
      tables.some((name) =>
        /public\.(?:organization_members|check_ins|food_discoveries|reward_events)$/.test(
          name,
        ),
      )
    ) {
      assert.equal(
        permission.trim().toLowerCase(),
        "select",
        "Membership and verified activity are server-owned mutations.",
      );
    }
    if (
      tables.includes("public.venues") &&
      /^update\b/i.test(permission.trim())
    ) {
      assert.doesNotMatch(
        permission,
        /\b(?:organization_id|status|ownership_verified_at|latitude|longitude)\b/i,
        "Clients must not update venue authority or verified coordinates.",
      );
    }
  }
});

test("static convention: page CSP uses nonces on request and response with dynamic rendering", () => {
  const proxy = source("apps/web/src/proxy.ts");
  assert.match(proxy, /randomBytes\(32\)/);
  assert.match(proxy, /requestHeaders\.set\("x-nonce", nonce\)/);
  assert.match(
    proxy,
    /requestHeaders\.set\("Content-Security-Policy", contentSecurityPolicy\)/,
  );
  assert.match(
    proxy,
    /response\.headers\.set\("Content-Security-Policy", contentSecurityPolicy\)/,
  );
  assert.match(proxy, /script-src[^\n]+nonce-\$\{nonce\}[^\n]+strict-dynamic/);
  assert.doesNotMatch(
    proxy.match(/script-src[^\n]+/)?.[0] ?? "",
    /unsafe-inline/,
  );
  assert.match(proxy, /isDevelopment \? " 'unsafe-eval'" : ""/);
  for (const directive of [
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ])
    assert.ok(proxy.includes(directive));
  assert.match(
    source("apps/web/src/app/layout.tsx"),
    /export const dynamic = "force-dynamic"/,
  );
});

test("static convention: UI source avoids em dashes and emoji characters", () => {
  const uiFiles = sourceFiles().filter((path) => {
    const name = relative(root, path).replaceAll("\\", "/");
    return (
      /^(?:apps\/(?:web|mobile)\/(?:src|app)|packages\/[^/]+\/src)\//.test(
        name,
      ) && /\.(?:ts|tsx|css|json)$/.test(name)
    );
  });
  const failures = uiFiles
    .filter((path) =>
      /\u2014|\p{Extended_Pictographic}/u.test(readFileSync(path, "utf8")),
    )
    .map((path) => relative(root, path));
  assert.deepEqual(
    failures,
    [],
    "Use plain text and the existing vector icon system in UI source.",
  );
});
