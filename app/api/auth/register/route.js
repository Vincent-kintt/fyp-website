import { getCollection } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { ensureNoStore } from "@/lib/api/cache.js";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  USERNAME_REGEX,
  EMAIL_REGEX,
  EMAIL_MAX_LENGTH,
} from "@/lib/auth/validation.js";

const registerSchema = z.object({
  username: z
    .string({ error: "Username, email, and password are required." })
    .min(1, "Username, email, and password are required.")
    .regex(
      USERNAME_REGEX,
      "Username must be 3-20 characters and contain only letters, numbers, and underscores.",
    ),
  email: z
    .string({ error: "Username, email, and password are required." })
    .min(1, "Username, email, and password are required.")
    .max(EMAIL_MAX_LENGTH, "Please provide a valid email address.")
    .regex(EMAIL_REGEX, "Please provide a valid email address."),
  password: z
    .string({ error: "Username, email, and password are required." })
    .min(8, "Password must be at least 8 characters."),
});

// Register endpoint rate limit. 5 attempts per 15 min per IP — wider window
// than the NextAuth login limiter (5 / 60s) because account creation is a
// once-or-twice-per-user action, while login bursts are normal. The wider
// window deters dictionary attacks against email enumeration without blocking
// a human typo-then-retry within the same session.
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60_000;

// Register echoes per-account state (collision answers / success-with-id) —
// every exit path must carry `Cache-Control: private, no-store`. Funnel all
// returns through `ensureNoStore` rather than threading headers manually
// through each response site.
async function handleRegister(request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { success, resetMs } = checkRateLimit(`register:${ip}`, {
    maxAttempts: RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!success) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
      },
    );
  }

  const { data: body, error: parseError } = await parseJsonBodyWithSchema(
    request,
    registerSchema,
  );
  if (parseError) return parseError;

  try {
    const { username, email, password } = body;

    const usersCollection = await getCollection("users");

    // Atomic insert under the unique indexes on `username` and `email`
    // (see scripts/createUserIndexes.js). MongoDB raises `code: 11000` on
    // collision; the catch below translates that to a 409 with the
    // field-specific message. This replaces the prior check-then-insert
    // (findOne(username) → findOne(email) → insertOne) which raced on
    // concurrent same-email registers.
    const hashedPassword = await bcrypt.hash(password, 10);

    await usersCollection.insertOne({
      username,
      email,
      password: hashedPassword,
      role: "user",
      createdAt: new Date(),
    });

    return NextResponse.json(
      { message: "Registration successful." },
      { status: 201 },
    );
  } catch (error) {
    if (error?.code === 11000) {
      // Inspect the duplicate key to surface the matching field's error
      // message. `keyPattern` is the index spec (e.g. { username: 1 }) and
      // `keyValue` is the conflicting document fragment. We prefer
      // `keyPattern` because it doesn't echo the user-supplied value back
      // to the client (defense against log injection / reflection vectors).
      const pattern = error.keyPattern || {};
      if (pattern.email) {
        return NextResponse.json(
          { error: "Email is already registered." },
          { status: 409 },
        );
      }
      // Default to username when keyPattern is missing or unrecognized —
      // covers the original "username taken" UX and any new unique index
      // that ships before the message map catches up.
      return NextResponse.json(
        { error: "Username is already taken." },
        { status: 409 },
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration. Please try again." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  return ensureNoStore(await handleRegister(request));
}
