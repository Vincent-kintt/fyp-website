/**
 * R9 mitigation (PR1 regression net) — automated guardrail that scans
 * tests/fixtures/* for patterns that strongly suggest real user data
 * leaked from a live API capture.
 *
 * This is a backstop only — the primary defense is manual review of
 * fixture diffs at PR time. The patterns here catch the common shapes
 * (real ObjectIds, real email domains, current-year ISO timestamps,
 * verbatim "userId" field markers). New leak shapes will need
 * new patterns added here.
 *
 * Allowlisted placeholder values (must use these in fixtures):
 *   - IDs: TEST_*, call_test_*, call_rss_*
 *   - Domains: example.com, example.org, example.net
 *   - Timestamps: 2024-01-01T*  (any 2024-01-01 time is fine)
 *   - Email-like strings: avoid entirely; if needed use test@example.com
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

function listFixtureFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listFixtureFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const FIXTURE_FILES = listFixtureFiles(FIXTURES_DIR);

// Patterns that strongly suggest real user data, with allowlist carve-outs.
const PII_PATTERNS = [
  {
    name: "real-looking ObjectId (24 hex chars not prefixed with TEST_/call_)",
    re: /(?<![A-Z_])(?<![A-Za-z0-9])[a-f0-9]{24}(?![A-Za-z0-9])/g,
  },
  {
    name: "real consumer email domain",
    re: /@(?:gmail|outlook|hotmail|yahoo|icloud|qq|163|me)\.com\b/gi,
  },
  {
    name: "current-or-recent-year ISO timestamp (must use 2024-01-01 in fixtures)",
    re: /\b(?:2025|2026|2027)-\d{2}-\d{2}T\d{2}:\d{2}/g,
  },
  {
    name: 'verbatim "userId" key with non-placeholder value',
    re: /"userId"\s*:\s*"(?!TEST_)[^"]+"/g,
  },
];

describe("tests/fixtures — no PII leaked from live API captures", () => {
  it("fixtures directory contains at least one file", () => {
    expect(FIXTURE_FILES.length).toBeGreaterThan(0);
  });

  for (const file of FIXTURE_FILES) {
    const relative = file.slice(file.indexOf("tests/fixtures"));
    it(`${relative} contains no PII patterns`, () => {
      const content = readFileSync(file, "utf8");
      const findings = [];
      for (const { name, re } of PII_PATTERNS) {
        const matches = content.match(re);
        if (matches) {
          findings.push(`${name}: ${matches.slice(0, 3).join(", ")}`);
        }
      }
      expect(findings).toEqual([]);
    });
  }
});
