#!/usr/bin/env node
import { auditClaims } from "./engine.js";

function parseArgs(argv) {
  const result = {
    command: "audit",
    repoPath: ".",
    outDir: undefined,
    readme: "README.md"
  };
  const args = [...argv];

  if (args[0] && !args[0].startsWith("-")) {
    result.command = args.shift();
  }

  if (result.command !== "audit") {
    throw new Error(`Unknown command: ${result.command}`);
  }

  if (args[0] && !args[0].startsWith("-")) {
    result.repoPath = args.shift();
  }

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--out") {
      result.outDir = args.shift();
    } else if (arg === "--readme") {
      result.readme = args.shift();
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return result;
}

function help() {
  return `ClaimProof

Usage:
  claimproof audit [repo] [--out dir] [--readme README.md]

Outputs: claims.json, report.md, report.html.
`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(help());
  } else {
    const result = await auditClaims(options);
    process.stdout.write(`ClaimProof ${result.packet.summary.readiness}\n`);
    process.stdout.write(`Score: ${result.packet.summary.score}\n`);
    process.stdout.write(`Report: ${result.outDir}/report.html\n`);
    process.stdout.write(`Packet: ${result.outDir}/claims.json\n`);
    process.exitCode = result.packet.summary.unsupported > 0 ? 2 : 0;
  }
} catch (error) {
  process.stderr.write(`ClaimProof failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
