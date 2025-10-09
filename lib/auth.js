import { getCollection } from "./db";
import bcrypt from "bcryptjs";

/**
 * Verify user credentials
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @returns {Object|null} User object or null if invalid
 */
export async function verifyCredentials(username, password) {
  try {
    const usersCollection = await getCollection("users");
    const user = await usersCollection.findOne({ username });

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return null;
    }

    // Return user without password
    return {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
    };
  } catch (error) {
    console.error("Error verifying credentials:", error);
    return null;
  }
}

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Object|null} User object or null
 */
export async function getUserById(userId) {
  try {
    const usersCollection = await getCollection("users");
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return null;
    }

    return {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
    };
  } catch (error) {
    console.error("Error getting user by ID:", error);
    return null;
  }
}
