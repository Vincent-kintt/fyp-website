export const metadata = {
  title: "ReminderApp - Never Forget Anything",
  description:
    "An intelligent reminder application to manage your tasks and reminders",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ReminderApp",
  },
};

export default function RootLayout({ children }) {
  return children;
}
