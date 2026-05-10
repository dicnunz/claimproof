# ClaimProof Report

**Readiness:** publish_ready
**Score:** 100
**Repo:** `/Users/nicdunz/Documents/Codex/2026-05-10/dig-through-my-github-and-tell/products/claimproof`

## Claims

| Status | Claim Area | Reason | Evidence |
| --- | --- | --- | --- |
| supported | Local-first or local-only operation | no obvious secret, telemetry, or external API dependency found | `repo text scan` |
| supported | No backend or server dependency | no common backend dependency or server/API directory found | `package.json`<br>`repo tree` |
| supported | No telemetry or tracking | no common telemetry keywords found | `repo text scan` |
| supported | No API key or paid API dependency | no API-key-like references found | `repo text scan` |
| supported | CLI or command-line workflow | package bin or CLI file exists | `package.json#bin`<br>`src/cli.js` |
| supported | Tests or verification commands | test or verification scripts/files exist | `script:test`<br>`script:verify`<br>`test/engine.test.js` |
| supported | Continuous integration | GitHub Actions workflow exists | `.github/workflows/ci.yml` |
| supported | Reports, packets, bundles, or export artifacts | report/export evidence exists | `script:demo`<br>`script:verify` |
| supported | License claim | license file exists | `LICENSE` |

## Source Lines

### Local-first or local-only operation
- "local-only", "no backend", "CLI", "tests", "sample report", "screenshots",
- local-first / local-only

### No backend or server dependency
- "local-only", "no backend", "CLI", "tests", "sample report", "screenshots",
- no backend

### No telemetry or tracking
- no telemetry

### No API key or paid API dependency
- no API key

### CLI or command-line workflow
- "local-only", "no backend", "CLI", "tests", "sample report", "screenshots",
- CLI workflow
- node src/cli.js audit . --out ./claimproof-report
- node src/cli.js audit /path/to/repo --out /tmp/claimproof-report

### Tests or verification commands
- "local-only", "no backend", "CLI", "tests", "sample report", "screenshots",
- tests, verification, lint, typecheck, or build scripts
- npm test
- npm run verify

### Continuous integration
- GitHub Actions CI

### Reports, packets, bundles, or export artifacts
- "local-only", "no backend", "CLI", "tests", "sample report", "screenshots",
- report, packet, bundle, export, JSON, Markdown, or HTML artifacts
- node src/cli.js audit . --out ./claimproof-report
- open claimproof-report/report.html
- node src/cli.js audit /path/to/repo --out /tmp/claimproof-report

### License claim
- or "MIT licensed" and you want to know whether the repository actually backs
- license files
- License
- MIT
