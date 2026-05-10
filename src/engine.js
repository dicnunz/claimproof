import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "coverage"]);
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".html",
  ".css",
  ".yml",
  ".yaml",
  ".py",
  ".sh"
]);

const CLAIM_RULES = [
  {
    id: "local-first",
    label: "Local-first or local-only operation",
    pattern: /\b(local[- ]first|local[- ]only|runs? locally|client[- ]side|in your browser)\b/i,
    check: evidenceLocalOnly
  },
  {
    id: "no-backend",
    label: "No backend or server dependency",
    pattern: /\b(no backend|no server|static app|static site)\b/i,
    check: evidenceNoBackend
  },
  {
    id: "no-telemetry",
    label: "No telemetry or tracking",
    pattern: /\b(no telemetry|no tracking|no analytics)\b/i,
    check: evidenceNoTelemetry
  },
  {
    id: "no-api-key",
    label: "No API key or paid API dependency",
    pattern: /\b(no api key|no paid api|no external api|no model api)\b/i,
    check: evidenceNoApiKey
  },
  {
    id: "cli",
    label: "CLI or command-line workflow",
    pattern: /\b(cli|command line|command-line|npx|bin)\b/i,
    check: evidenceCli
  },
  {
    id: "tests",
    label: "Tests or verification commands",
    pattern: /\b(test|tests|verify|validation|typecheck|lint|build)\b/i,
    check: evidenceTests
  },
  {
    id: "ci",
    label: "Continuous integration",
    pattern: /\b(ci|github actions|workflow badge|actions\/workflows)\b/i,
    check: evidenceCi
  },
  {
    id: "report-artifacts",
    label: "Reports, packets, bundles, or export artifacts",
    pattern: /\b(report|packet|bundle|artifact|export|json|markdown|html)\b/i,
    check: evidenceReports
  },
  {
    id: "screenshots-demo",
    label: "Screenshots, demo media, or visual proof",
    pattern: /\b(screenshot|demo gif|demo video|preview|social card|assets?)\b/i,
    check: evidenceMedia
  },
  {
    id: "license",
    label: "License claim",
    pattern: /\b(mit|apache|license|licensed)\b/i,
    check: evidenceLicense
  }
];

function now() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const path = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(rootDir, path)));
      continue;
    }

    files.push(relative(rootDir, path).replaceAll("\\", "/"));
  }

  return files.sort();
}

async function readPackage(repoPath) {
  try {
    return JSON.parse(await readFile(join(repoPath, "package.json"), "utf8"));
  } catch {
    return {};
  }
}

async function readTextCorpus(repoPath, files) {
  const chunks = [];
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) {
      continue;
    }

    try {
      chunks.push(await readFile(join(repoPath, file), "utf8"));
    } catch {
      // Ignore unreadable files; the report is about available evidence.
    }
  }

  return chunks.join("\n").slice(0, 1_000_000);
}

function scripts(packageJson) {
  return packageJson.scripts && typeof packageJson.scripts === "object"
    ? packageJson.scripts
    : {};
}

function deps(packageJson) {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies
  };
}

function support(reason, evidence = []) {
  return { status: "supported", reason, evidence };
}

function weak(reason, evidence = []) {
  return { status: "weak", reason, evidence };
}

function unsupported(reason, evidence = []) {
  return { status: "unsupported", reason, evidence };
}

function evidenceLocalOnly(context) {
  const suspicious = findSuspiciousNetworkOrSecrets(context);
  if (suspicious.length > 0) {
    return weak("local-first claim exists, but network/API-key-like evidence needs review", suspicious);
  }

  return support("no obvious secret, telemetry, or external API dependency found", ["repo text scan"]);
}

function evidenceNoBackend(context) {
  const backendDeps = ["express", "fastify", "koa", "hono", "@nestjs/core", "apollo-server"];
  const foundDeps = backendDeps.filter((name) => context.dependencies[name]);
  const serverFiles = context.files.filter((file) => /(^|\/)(server|api|routes)(\/|\.|$)/i.test(file));

  if (foundDeps.length || serverFiles.length) {
    return weak("backend-related dependency or file exists", [...foundDeps, ...serverFiles].slice(0, 8));
  }

  return support("no common backend dependency or server/API directory found", ["package.json", "repo tree"]);
}

function evidenceNoTelemetry(context) {
  const hits = grep(context.corpus, /\b(posthog\.(init|capture)|analytics\.track|gtag\(|amplitude\.init|mixpanel\.track|plausible\()/gi);
  if (hits.length > 0) {
    return weak("telemetry-related words exist and need human review", hits);
  }

  return support("no common telemetry keywords found", ["repo text scan"]);
}

function evidenceNoApiKey(context) {
  const hits = grep(context.corpus, /\b(process\.env\.[A-Z0-9_]*(API_KEY|TOKEN|SECRET)|import\.meta\.env\.[A-Z0-9_]*(API_KEY|TOKEN|SECRET))\b/g);
  if (hits.length > 0) {
    return weak("API-key-like references exist", hits);
  }

  return support("no API-key-like references found", ["repo text scan"]);
}

function evidenceCli(context) {
  const hasBin = typeof context.packageJson.bin === "string" || Boolean(context.packageJson.bin && Object.keys(context.packageJson.bin).length);
  const cliFiles = context.files.filter((file) => /(^|\/)(cli|bin)(\.|\/)/i.test(file));

  if (hasBin || cliFiles.length) {
    return support("package bin or CLI file exists", [hasBin ? "package.json#bin" : "", ...cliFiles].filter(Boolean).slice(0, 8));
  }

  return unsupported("README mentions CLI workflow, but no package bin or CLI file was found");
}

function evidenceTests(context) {
  const scriptNames = Object.keys(context.scripts).filter((name) => /test|verify|lint|typecheck|build/i.test(name));
  const testFiles = context.files.filter((file) => /(\btest\b|\btests\b|\.test\.|\.spec\.)/i.test(file));

  if (scriptNames.length || testFiles.length) {
    return support("test or verification scripts/files exist", [...scriptNames.map((name) => `script:${name}`), ...testFiles].slice(0, 10));
  }

  return unsupported("README mentions testing or verification, but no matching script or test file was found");
}

function evidenceCi(context) {
  const workflows = context.files.filter((file) => file.startsWith(".github/workflows/"));
  return workflows.length
    ? support("GitHub Actions workflow exists", workflows)
    : unsupported("README mentions CI, but no .github/workflows file was found");
}

function evidenceReports(context) {
  const reportFiles = context.files.filter((file) => /\b(report|packet|bundle|artifact|export)\b/i.test(file));
  const outputScripts = Object.entries(context.scripts)
    .filter(([name, value]) => /report|packet|bundle|export|demo|verify/i.test(`${name} ${value}`))
    .map(([name]) => `script:${name}`);

  if (reportFiles.length || outputScripts.length) {
    return support("report/export evidence exists", [...reportFiles, ...outputScripts].slice(0, 10));
  }

  return unsupported("README promises report/export artifacts, but no matching files or scripts were found");
}

function evidenceMedia(context) {
  const media = context.files.filter((file) => /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm)$/i.test(file));
  return media.length
    ? support("visual proof assets exist", media.slice(0, 10))
    : unsupported("README mentions screenshots/demo media, but no image/video assets were found");
}

function evidenceLicense(context) {
  const license = context.files.find((file) => /^licen[cs]e(\.|$)/i.test(file));
  return license
    ? support("license file exists", [license])
    : unsupported("license is mentioned, but no LICENSE file was found");
}

function findSuspiciousNetworkOrSecrets(context) {
  return grep(
    context.corpus,
    /\b(fetch\(["']https?:|axios\.(get|post|request)|posthog\.(init|capture)|analytics\.track|process\.env\.[A-Z0-9_]*(API_KEY|TOKEN|SECRET)|import\.meta\.env\.[A-Z0-9_]*(API_KEY|TOKEN|SECRET))\b/g
  );
}

function grep(text, regex) {
  const hits = new Set();
  for (const match of text.matchAll(regex)) {
    hits.add(match[0]);
    if (hits.size >= 12) {
      break;
    }
  }

  return [...hits];
}

function extractClaimTexts(readme, rule) {
  const lines = readme
    .split(/\n+/)
    .map((line) => line.replace(/^[-*>#\s]+/, "").trim())
    .filter(Boolean);

  return lines.filter((line) => rule.pattern.test(line)).slice(0, 5);
}

function summarize(claims) {
  const counts = {
    supported: claims.filter((claim) => claim.status === "supported").length,
    weak: claims.filter((claim) => claim.status === "weak").length,
    unsupported: claims.filter((claim) => claim.status === "unsupported").length
  };
  const total = claims.length;
  const score = total === 0 ? 0 : Math.round(((counts.supported * 2 + counts.weak) / (total * 2)) * 100);
  const readiness =
    total === 0
      ? "no_claims_found"
      : counts.unsupported > 0
        ? "needs_evidence"
        : counts.weak > 0
          ? "needs_review"
          : "publish_ready";

  return { ...counts, total, score, readiness };
}

function markdownReport(packet) {
  const rows = packet.claims
    .map(
      (claim) =>
        `| ${claim.status} | ${claim.label} | ${claim.reason.replaceAll("|", "\\|")} | ${claim.evidence.map((item) => `\`${item}\``).join("<br>")} |`
    )
    .join("\n");

  return `# ClaimProof Report

**Readiness:** ${packet.summary.readiness}
**Score:** ${packet.summary.score}
**Repo:** \`${packet.repo.path}\`

## Claims

| Status | Claim Area | Reason | Evidence |
| --- | --- | --- | --- |
${rows || "| none | No recognized claims | - | - |"}

## Source Lines

${packet.claims
  .map((claim) => `### ${claim.label}\n${claim.sources.map((source) => `- ${source}`).join("\n")}`)
  .join("\n\n") || "No recognized claim lines found."}
`;
}

function htmlReport(packet) {
  const claimCards = packet.claims
    .map(
      (claim) => `<article class="card ${escapeHtml(claim.status)}">
  <div class="row"><strong>${escapeHtml(claim.status)}</strong><span>${escapeHtml(claim.label)}</span></div>
  <p>${escapeHtml(claim.reason)}</p>
  <ul>${claim.evidence.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("") || "<li>No evidence found</li>"}</ul>
</article>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(packet.repo.name)} - ClaimProof</title>
  <style>
    :root { --bg:#f5f7f4; --panel:#fffef9; --ink:#151916; --muted:#5d665f; --line:#d6ddd3; --ok:#17633a; --warn:#8a5b00; --bad:#a12d22; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width:min(1100px, calc(100vw - 32px)); margin:28px auto 52px; display:grid; gap:16px; }
    section, .card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; }
    h1, h2, p { margin:0; } h1 { font-size:2.4rem; line-height:1; }
    .hero { display:grid; gap:12px; }
    .pill { width:fit-content; border-radius:999px; background:#e8eee4; padding:8px 12px; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; }
    .metric strong { display:block; font-size:1.8rem; }
    .row { display:flex; justify-content:space-between; gap:12px; align-items:baseline; flex-wrap:wrap; }
    .supported strong { color:var(--ok); } .weak strong { color:var(--warn); } .unsupported strong { color:var(--bad); }
    code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    ul { margin:10px 0 0; padding-left:20px; }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <span class="pill">${escapeHtml(packet.summary.readiness)}</span>
      <h1>${escapeHtml(packet.repo.name)}</h1>
      <p>Claim evidence audit generated ${escapeHtml(packet.generatedAt)}.</p>
    </section>
    <section class="grid">
      <div class="metric"><span>Score</span><strong>${packet.summary.score}</strong></div>
      <div class="metric"><span>Supported</span><strong>${packet.summary.supported}</strong></div>
      <div class="metric"><span>Weak</span><strong>${packet.summary.weak}</strong></div>
      <div class="metric"><span>Unsupported</span><strong>${packet.summary.unsupported}</strong></div>
    </section>
    <section><h2>Claims</h2>${claimCards || "<p>No recognized claim lines found.</p>"}</section>
  </main>
</body>
</html>`;
}

export async function auditClaims(options = {}) {
  const repoPath = resolve(options.repoPath || ".");
  const outDir = resolve(options.outDir || join(repoPath, "claimproof-report"));
  const readmePath = join(repoPath, options.readme || "README.md");
  const readme = await readFile(readmePath, "utf8");
  const files = await walk(repoPath);
  const packageJson = await readPackage(repoPath);
  const context = {
    repoPath,
    readme,
    files,
    packageJson,
    scripts: scripts(packageJson),
    dependencies: deps(packageJson),
    corpus: await readTextCorpus(repoPath, files)
  };
  const claims = [];

  for (const rule of CLAIM_RULES) {
    const sources = extractClaimTexts(readme, rule);
    if (sources.length === 0) {
      continue;
    }

    const verdict = rule.check(context);
    claims.push({
      id: rule.id,
      label: rule.label,
      sources,
      ...verdict
    });
  }

  const packet = {
    schemaVersion: "1.0.0",
    generatedAt: now(),
    repo: {
      name: basename(repoPath),
      path: repoPath,
      readme: relative(repoPath, readmePath).replaceAll("\\", "/")
    },
    summary: summarize(claims),
    claims
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "claims.json"), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  await writeFile(join(outDir, "report.md"), markdownReport(packet), "utf8");
  await writeFile(join(outDir, "report.html"), htmlReport(packet), "utf8");

  return { packet, outDir };
}
