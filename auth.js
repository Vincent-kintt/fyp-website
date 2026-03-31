/**
 * Auth.js Full Configuration (Node.js runtime)
 * Used by API routes - includes MongoDB for credential verification
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getCollection } from "@/lib/db";
import { authConfig } from "./auth.config";

import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const usersCollection = await getCollection("users");
          const user = await usersCollection.findOne({ 
            username: credentials.username 
          });

          if (!user) {
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password, 
            user.password
          );

          if (!isValid) {
            return null;
          }

          return {
            id: user._id.toString(),
            username: user.username,
            role: user.role,
          };
        } catch (error) {
          console.error("Error verifying credentials:", error);
          return null;
        }
      },
    }),
  ],
});
