import { describe, it, expect } from "vitest";
import {
  ICON_MAP,
  ICON_CATEGORIES,
  ICON_COLOR_NAMES,
  getIconComponent,
  getIconColor,
} from "@/lib/notes/iconMap";

describe("icon data integration", () => {
  it("icon data model shape is valid", () => {
    const iconData = { name: "file-text", color: "blue" };
    expect(ICON_MAP[iconData.name]).toBeDefined();
    expect(ICON_COLOR_NAMES).toContain(iconData.color);
  });

  it("null icon returns fallback component", () => {
    const comp = getIconComponent(undefined);
    expect(comp).toBeDefined();
  });

  it("each icon appears in at most one category", () => {
    // The previous snapshot assertion ("length === 60") was a dataset
    // count, not a behavior — adding a new icon would false-fail it.
    // The invariant that matters is no-duplicates within ICON_CATEGORIES.
    const allCategoryIcons = Object.values(ICON_CATEGORIES).flat();
    expect(new Set(allCategoryIcons).size).toBe(allCategoryIcons.length);
  });

  it("each color has both light and dark variants", () => {
    for (const color of ICON_COLOR_NAMES) {
      const light = getIconColor(color, "light");
      const dark = getIconColor(color, "dark");
      expect(light).toBeTruthy();
      expect(dark).toBeTruthy();
    }
  });
});
