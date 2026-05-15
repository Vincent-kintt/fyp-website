import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
);

// R0 mitigation: BlockNote integration relies on private API surfaces
// (editor._tiptapEditor, editor.getExtension(SuggestionMenu)?.shown(),
// tiptap.commands.liftListItem, registerPlugin prepend semantics). A minor
// BlockNote version bump can break any of these silently. Pin exact versions
// here as a CI gate; bumping requires updating this allowlist AND re-reading
// the private-API docstrings in the affected plugin files.
const REQUIRED_BLOCKNOTE_VERSIONS = {
  "@blocknote/core": "0.47.3",
  "@blocknote/mantine": "0.47.3",
  "@blocknote/react": "0.47.3",
};

describe("BlockNote version lock (R0 mitigation)", () => {
  it("pins @blocknote/* to exact versions in package.json", () => {
    for (const [pkg, expected] of Object.entries(REQUIRED_BLOCKNOTE_VERSIONS)) {
      const actual = packageJson.dependencies?.[pkg];
      expect(actual, `${pkg} must be present in dependencies`).toBeDefined();
      expect(actual, `${pkg} must be pinned to ${expected} (no ranges)`).toBe(
        expected,
      );
    }
  });

  it("rejects caret/tilde ranges on @blocknote/* dependencies", () => {
    for (const pkg of Object.keys(REQUIRED_BLOCKNOTE_VERSIONS)) {
      const actual = packageJson.dependencies?.[pkg];
      expect(actual, `${pkg} must not start with ^ or ~`).not.toMatch(/^[\^~]/);
    }
  });
});
