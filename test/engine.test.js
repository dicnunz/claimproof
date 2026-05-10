import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { auditClaims } from "../src/engine.js";

async function makeRepo(readme, extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), "claimproof-"));
  await writeFile(join(dir, "README.md"), readme);
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify(
      extra.packageJson || {
        bin: { demo: "./src/cli.js" },
        scripts: { test: "node --test", verify: "npm test" }
      },
      null,
      2
    )
  );
  await mkdir(join(dir, "src"), { recursive: true });
  await writeFile(join(dir, "src", "cli.js"), "#!/usr/bin/env node\nconsole.log('demo')\n");
  await writeFile(join(dir, "LICENSE"), "MIT\n");
  return dir;
}

test("auditClaims supports claims with concrete repo evidence", async () => {
  const repo = await makeRepo(`# Demo

Demo is local-only and needs no API key.
It ships a CLI and verification tests.
The package is MIT licensed.
`);
  try {
    const result = await auditClaims({ repoPath: repo, outDir: join(repo, "proof") });
    assert.equal(result.packet.summary.unsupported, 0);
    assert.equal(result.packet.summary.readiness, "publish_ready");

    const report = await readFile(join(repo, "proof", "report.md"), "utf8");
    assert.match(report, /Local-first/);
    assert.match(report, /CLI/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("auditClaims flags unsupported proof-heavy claims", async () => {
  const repo = await makeRepo(
    `# Thin Demo

Thin Demo has screenshots, CI, and exported report artifacts.
`,
    { packageJson: { scripts: {} } }
  );

  try {
    const result = await auditClaims({ repoPath: repo, outDir: join(repo, "proof") });
    assert.equal(result.packet.summary.readiness, "needs_evidence");
    assert.ok(result.packet.claims.some((claim) => claim.status === "unsupported"));
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
