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

  it("all 60 icons are distributed across categories", () => {
    const allCategoryIcons = Object.values(ICON_CATEGORIES).flat();
    expect(allCategoryIcons.length).toBe(60);
    expect(new Set(allCategoryIcons).size).toBe(60);
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
