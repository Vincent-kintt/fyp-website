import { describe, it, expect } from "vitest";
import { FaClock, FaPlay, FaCheck, FaPause } from "react-icons/fa";
import { getStatusIconComponent } from "@/components/reminders/statusIcons.js";

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
});
