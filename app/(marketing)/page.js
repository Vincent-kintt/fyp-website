import { DM_Serif_Display, Outfit } from "next/font/google";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ClientRedirect from "@/components/auth/ClientRedirect";
import Button from "@/components/ui/Button";
import ScrollReveal from "@/components/ui/ScrollReveal";
import { LuCalendarDays, LuTag, LuBell } from "react-icons/lu";

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata = {
  title: "Reminder — Never Forget What Matters",
  description:
    "An elegant system for capturing, organizing, and completing your reminders — so your mind stays clear.",
};

const features = [
  {
    icon: LuCalendarDays,
    title: "Recurring Schedules",
    description:
      "Set reminders for specific dates or create recurring ones — daily, weekly, monthly, or yearly.",
  },
  {
    icon: LuTag,
    title: "Flexible Tags",
    description:
      "Organize your way with custom color-coded labels like work, personal, health, or anything you need.",
  },
  {
    icon: LuBell,
    title: "Smart Alerts",
    description:
      "Get timely push notifications so you never miss an important task or event.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div
      className={`${dmSerif.variable} ${outfit.variable}`}
      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
    >
      <ClientRedirect />

      {/* Hero */}
      <section className="pt-12 pb-10 px-5 md:pt-20 md:pb-16 md:px-12 lg:px-16 max-w-4xl">
        <p className="text-xs uppercase tracking-[0.12em] font-medium text-[#6366f1] dark:text-[#818cf8] mb-5 md:mb-6">
          Personal Productivity
        </p>
        <h1
          className="text-4xl md:text-5xl lg:text-6xl leading-[1.15] tracking-tight mb-4 text-[#1c1917] dark:text-[#fafafa]"
          style={{ fontFamily: "var(--font-dm-serif), serif" }}
        >
          Never forget what matters.
        </h1>
        <p className="text-base md:text-lg leading-relaxed font-light max-w-md mb-8 text-[#78716c] dark:text-[#71717a]">
          An elegant system for capturing, organizing, and completing your
          reminders — so your mind stays clear.
        </p>
        <Button href="/login" variant="primary" className="text-sm md:text-base px-6 py-3">
          Get Started <span className="ml-1">→</span>
        </Button>
      </section>

      {/* Divider */}
      <div
        className="h-px mx-5 md:mx-12 lg:mx-16"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--border) 50%, transparent)",
        }}
      />

      {/* Features */}
      <ScrollReveal>
        <section className="py-10 md:py-12 px-5 md:px-12 lg:px-16 max-w-5xl">
          <p className="text-[10px] uppercase tracking-[0.14em] font-medium text-[#a8a29e] dark:text-[#52525b] mb-6 md:mb-8">
            Capabilities
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            {features.map((feat) => (
              <div key={feat.title} className="flex md:flex-col gap-3 md:gap-3 items-start">
                <div className="w-10 h-10 rounded-[10px] bg-[#6366f1]/[0.06] dark:bg-[#818cf8]/[0.06] border border-[#6366f1]/[0.1] dark:border-[#818cf8]/[0.1] flex items-center justify-center shrink-0">
                  <feat.icon className="w-[18px] h-[18px] text-[#6366f1] dark:text-[#818cf8]" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[#1c1917] dark:text-[#d4d4d8] mb-1">
                    {feat.title}
                  </h3>
                  <p className="text-xs font-light leading-relaxed text-[#a8a29e] dark:text-[#52525b]">
                    {feat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
