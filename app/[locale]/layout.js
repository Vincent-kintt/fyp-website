import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import Footer from "@/components/layout/Footer";
import Providers from "../providers";
import ThemeProvider from "@/components/ThemeProvider";

export async function generateMetadata() {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen bg-background`}
      >
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <Providers>
              <a href="#main-content" className="skip-to-content">
                Skip to content
              </a>
              <Navbar />
              <div className="flex flex-1">
                <Sidebar />
                <main
                  id="main-content"
                  className="flex-1 w-full pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0"
                >
                  {children}
                </main>
              </div>
              <BottomNav />
              <div className="hidden md:block">
                <Footer />
              </div>
            </Providers>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
