import { getCollection } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";

// Validate username: 3-20 chars, alphanumeric and underscores only
const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

// Validate email: HTML5-spec regex (rejects <>"' etc.) + RFC 5321 length limit
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const registerSchema = z.object({
  username: z
    .string({ error: "Username, email, and password are required." })
    .min(1, "Username, email, and password are required.")
    .regex(
      usernameRegex,
      "Username must be 3-20 characters and contain only letters, numbers, and underscores.",
    ),
  email: z
    .string({ error: "Username, email, and password are required." })
    .min(1, "Username, email, and password are required.")
    .max(254, "Please provide a valid email address.")
    .regex(emailRegex, "Please provide a valid email address."),
  password: z
    .string({ error: "Username, email, and password are required." })
    .min(8, "Password must be at least 8 characters."),
});

export async function POST(request) {
  const { data: body, error: parseError } = await parseJsonBodyWithSchema(
    request,
    registerSchema,
  );
  if (parseError) return parseError;

  try {
    const { username, email, password } = body;

    const usersCollection = await getCollection("users");

    // Check if username already exists
    const existingUsername = await usersCollection.findOne({ username });
    if (existingUsername) {
      return NextResponse.json(
        { error: "Username is already taken." },
        { status: 409 }
      );
    }

    // Check if email already exists
    const existingEmail = await usersCollection.findOne({ email });
    if (existingEmail) {
      return NextResponse.json(
        { error: "Email is already registered." },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await usersCollection.insertOne({
      username,
      email,
      password: hashedPassword,
      role: "user",
      createdAt: new Date(),
    });

    return NextResponse.json(
      { message: "Registration successful." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration. Please try again." },
      { status: 500 }
    );
  }
}
