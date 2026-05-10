import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { auditClaims } from "../src/engine.js";

const rootDir = resolve(import.meta.dirname, "..");
const sampleReport = join(rootDir, "examples", "sample-report");

await rm(sampleReport, { recursive: true, force: true });
const result = await auditClaims({
  repoPath: rootDir,
  outDir: sampleReport
});

process.stdout.write(`Demo report: ${result.outDir}/report.html\n`);
