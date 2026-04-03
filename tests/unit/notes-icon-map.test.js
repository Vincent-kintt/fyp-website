import { describe, it, expect } from "vitest";
import {
  ICON_MAP,
  ICON_CATEGORIES,
  ICON_COLORS,
  ICON_COLOR_NAMES,
  ALL_ICON_NAMES,
  getIconComponent,
  getIconColor,
} from "@/lib/notes/iconMap.js";

describe("getIconComponent", () => {
  it("returns a component for known icon", () => {
    const Icon = getIconComponent("file-text");
    expect(Icon).toBeDefined();
    expect(typeof Icon).toBe("object"); // forwardRef component
  });

  it("returns File as fallback for unknown icon", () => {
    const fallback = getIconComponent("nonexistent-icon");
    const fileIcon = getIconComponent("file");
    expect(fallback).toBe(fileIcon);
  });
});

describe("ICON_CATEGORIES", () => {
  it("all category icons exist in ICON_MAP", () => {
    for (const [category, names] of Object.entries(ICON_CATEGORIES)) {
      for (const name of names) {
        expect(ICON_MAP[name], `${category}/${name} missing from ICON_MAP`).toBeDefined();
      }
    }
  });
});

describe("ALL_ICON_NAMES", () => {
  it("matches ICON_MAP keys length", () => {
    expect(ALL_ICON_NAMES.length).toBe(Object.keys(ICON_MAP).length);
  });
});

describe("getIconColor", () => {
  it("returns hex string for all 7 colors × 2 themes", () => {
    for (const colorName of ICON_COLOR_NAMES) {
      for (const theme of ["light", "dark"]) {
        const hex = getIconColor(colorName, theme);
        expect(hex, `${colorName}/${theme}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("falls back to gray for unknown color", () => {
    const fallback = getIconColor("nonexistent", "light");
    const gray = getIconColor("gray", "light");
    expect(fallback).toBe(gray);
  });
});
