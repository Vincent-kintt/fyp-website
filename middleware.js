import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/reminders/:path*",
    "/api/reminders/:path*",
    "/api/ai/:path*",
    "/api/push/:path*",
    "/api/account/:path*",
    "/dashboard",
    "/inbox",
    "/calendar",
    "/login",
    "/register",
  ],
};
