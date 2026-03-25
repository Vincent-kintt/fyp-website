import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/reminders/:path*",
    "/api/reminders/:path*",
    "/dashboard",
    "/inbox",
    "/calendar",
  ],
};
