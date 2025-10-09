export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/reminders/:path*",
    "/api/reminders/:path*",
  ],
};
