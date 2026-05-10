# ClaimProof

ClaimProof audits a repo README against concrete repo evidence.

It is for the moment right before a product goes public, when the copy says
"local-only", "no backend", "CLI", "tests", "sample report", "screenshots",
or "MIT licensed" and you want to know whether the repository actually backs
those claims.

No model judge. No network calls. No upload. It is deterministic static
analysis over local files.

## What It Checks

ClaimProof recognizes common public-product claims and checks for supporting
evidence:

- local-first / local-only
- no backend
- no telemetry
- no API key
- CLI workflow
- tests, verification, lint, typecheck, or build scripts
- GitHub Actions CI
- report, packet, bundle, export, JSON, Markdown, or HTML artifacts
- screenshots, demo media, or visual proof
- license files

Each claim becomes `supported`, `weak`, or `unsupported` with the evidence path
or reason attached.

## Quickstart

```sh
git clone https://github.com/dicnunz/claimproof.git
cd claimproof
npm test
node src/cli.js audit . --out ./claimproof-report
open claimproof-report/report.html
```

Against another repo:

```sh
node src/cli.js audit /path/to/repo --out /tmp/claimproof-report
```

## Output

```text
claimproof-report/
  claims.json
  report.md
  report.html
```

`claims.json` is the source of truth. The reports are readable projections.

## Why This Exists

Small AI-built tools often look better in the README than in the repo. ClaimProof
keeps public claims honest without turning the review into a subjective taste
fight.

The intended release gate is simple:

```sh
npm run verify
```

Regenerate the committed sample report:

```sh
npm run demo
```

If ClaimProof says `needs_evidence`, either add the missing proof or remove the
claim.

## Scope

ClaimProof is intentionally conservative. It checks obvious local evidence and
flags weak areas for review. It does not prove legal compliance, security,
privacy, or complete correctness.

## License

MIT
