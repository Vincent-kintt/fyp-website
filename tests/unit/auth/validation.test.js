// tests/unit/auth/validation.test.js
import { describe, it, expect } from "vitest";
import {
  USERNAME_REGEX,
  EMAIL_REGEX,
  EMAIL_MAX_LENGTH,
} from "@/lib/auth/validation.js";

describe("USERNAME_REGEX", () => {
  it("accepts a simple lowercase username", () => {
    expect(USERNAME_REGEX.test("alice")).toBe(true);
  });

  it("accepts mixed alphanumeric with underscore", () => {
    expect(USERNAME_REGEX.test("alice_123")).toBe(true);
  });

  it("accepts the minimum length of 3 chars", () => {
    expect(USERNAME_REGEX.test("abc")).toBe(true);
  });

  it("accepts the maximum length of 20 chars", () => {
    expect(USERNAME_REGEX.test("a".repeat(20))).toBe(true);
  });

  it("rejects a username shorter than 3 chars", () => {
    expect(USERNAME_REGEX.test("ab")).toBe(false);
  });

  it("rejects a username longer than 20 chars", () => {
    expect(USERNAME_REGEX.test("a".repeat(21))).toBe(false);
  });

  it("rejects hyphens", () => {
    expect(USERNAME_REGEX.test("alice-bob")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(USERNAME_REGEX.test("alice bob")).toBe(false);
  });
});

describe("EMAIL_REGEX", () => {
  it("accepts a basic email", () => {
    expect(EMAIL_REGEX.test("foo@bar.com")).toBe(true);
  });

  it("accepts subdomain + plus addressing", () => {
    expect(EMAIL_REGEX.test("a.b+c@example.co.uk")).toBe(true);
  });

  it("accepts HTML5-spec local part special chars", () => {
    expect(EMAIL_REGEX.test("x!y@example.com")).toBe(true);
  });

  it("rejects angle brackets in the domain (XSS-flavored input)", () => {
    expect(EMAIL_REGEX.test("foo@<script>.com")).toBe(false);
  });

  it("accepts a single-label domain (HTML5 spec permits TLD-less hosts)", () => {
    // The HTML5-spec regex is intentionally permissive about single-label
    // hosts; TLD-less email is uncommon in the public Internet but valid for
    // intranet addresses, so the unification keeps this behavior.
    expect(EMAIL_REGEX.test("foo@bar")).toBe(true);
  });

  it("rejects an email with no local part", () => {
    expect(EMAIL_REGEX.test("@bar.com")).toBe(false);
  });

  it("rejects an email with an empty subdomain segment", () => {
    expect(EMAIL_REGEX.test("foo@.com")).toBe(false);
  });

  it("rejects whitespace in the local part", () => {
    expect(EMAIL_REGEX.test("foo bar@example.com")).toBe(false);
  });
});

describe("EMAIL_MAX_LENGTH", () => {
  it("equals 254 (RFC 5321 path length cap)", () => {
    expect(EMAIL_MAX_LENGTH).toBe(254);
  });
});
