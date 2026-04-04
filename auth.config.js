/**
 * Auth.js Edge-compatible configuration
 * Used by middleware - NO MongoDB/Node.js dependencies here
 */
import Credentials from "next-auth/providers/credentials";
import { routing } from "@/i18n/routing";

const nonDefaultLocales = routing.locales.filter(
  (l) => l !== routing.defaultLocale,
);
const localeStripRegex =
  nonDefaultLocales.length > 0
    ? new RegExp(`^\\/(${nonDefaultLocales.join("|")})(\/|$)`)
    : null;

export const authConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // Authorization is handled in the full auth.js config
      // This is just for type definition in Edge runtime
      authorize: () => null,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Strip locale prefix (e.g. /en/dashboard -> /dashboard)
      // Default locale (zh-TW) has no prefix thanks to localePrefix: "as-needed"
      const pathname = localeStripRegex
        ? nextUrl.pathname.replace(localeStripRegex, "/")
        : nextUrl.pathname;

      const isOnProtectedRoute =
        pathname.startsWith("/reminders") ||
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/inbox") ||
        pathname.startsWith("/calendar") ||
        pathname.startsWith("/notes") ||
        pathname.startsWith("/all");

      if (isOnProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }

      // Redirect logged-in users away from auth pages
      const isAuthPage =
        pathname === "/login" || pathname === "/register";
      if (isAuthPage && isLoggedIn) {
        const localeMatch = localeStripRegex
          ? nextUrl.pathname.match(localeStripRegex)
          : null;
        const prefix = localeMatch ? `/${localeMatch[1]}` : "";
        return Response.redirect(new URL(`${prefix}/dashboard`, nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
