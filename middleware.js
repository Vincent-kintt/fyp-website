import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Auth callback already ran — `req.auth` is populated.
  // Let next-intl handle locale negotiation & rewriting for every request.
  return intlMiddleware(req);
});

export const config = {
  matcher: [
    // Match all paths except static assets, _next internals, and API routes
    "/((?!api|_next|.*\\..*).*)",
  ],
};
