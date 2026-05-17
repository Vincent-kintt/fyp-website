import { describe, it, expect } from "vitest";
import { FaClock, FaPlay, FaCheck, FaPause } from "react-icons/fa";
import { getStatusIconComponent } from "@/components/reminders/statusIcons.js";
import { REMINDER_STATUSES } from "@/lib/utils";

describe("getStatusIconComponent", () => {
  it("resolves each canonical status to its react-icons component", () => {
    expect(getStatusIconComponent("pending")).toBe(FaClock);
    expect(getStatusIconComponent("in_progress")).toBe(FaPlay);
    expect(getStatusIconComponent("completed")).toBe(FaCheck);
    expect(getStatusIconComponent("snoozed")).toBe(FaPause);
  });

  it("falls back to FaClock for an unknown status (via STATUS_CONFIG pending)", () => {
    expect(getStatusIconComponent("not-a-real-status")).toBe(FaClock);
    expect(getStatusIconComponent(undefined)).toBe(FaClock);
    expect(getStatusIconComponent(null)).toBe(FaClock);
  });

  // Characterization: catches the regression where STATUS_CONFIG.icon for a
  // canonical status is changed to a string not in ICON_BY_NAME — the helper
  // would silently fall back to FaClock for that status without this guard.
  it("returns a defined icon component for every canonical status", () => {
    for (const status of REMINDER_STATUSES) {
      expect(getStatusIconComponent(status)).toBeDefined();
      expect(typeof getStatusIconComponent(status)).toBe("function");
    }
  });
});
