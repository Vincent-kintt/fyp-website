/**
 * Tests for lib/queryKeys.js — locks canonical key shapes so cache drift is
 * caught before it ships stale data to a consumer.
 */

import { describe, it, expect } from "vitest";

import { reminderKeys, noteKeys } from "@/lib/queryKeys";

describe("reminderKeys", () => {
  it("all is the root namespace", () => {
    expect(reminderKeys.all).toEqual(["tasks"]);
  });

  it("lists() nests under all", () => {
    expect(reminderKeys.lists()).toEqual(["tasks", "list"]);
  });

  it("list(filters) appends the filters object", () => {
    expect(reminderKeys.list({})).toEqual(["tasks", "list", {}]);
    expect(reminderKeys.list({ tag: "work" })).toEqual([
      "tasks",
      "list",
      { tag: "work" },
    ]);
  });

  it("detail(id) returns the canonical detail key under all", () => {
    expect(reminderKeys.detail("r1")).toEqual(["tasks", "detail", "r1"]);
  });

  it("detail(id) does not collide with list({})", () => {
    expect(reminderKeys.detail("r1")).not.toEqual(reminderKeys.list({}));
  });
});

describe("noteKeys", () => {
  it("all is the root namespace", () => {
    expect(noteKeys.all).toEqual(["notes"]);
  });

  it("lists() nests under all", () => {
    expect(noteKeys.lists()).toEqual(["notes", "list"]);
  });

  it("detail(id) returns the canonical detail key", () => {
    expect(noteKeys.detail("n1")).toEqual(["notes", "detail", "n1"]);
  });
});
