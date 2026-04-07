import { DM_Serif_Display, Outfit } from "next/font/google";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ClientRedirect from "@/components/auth/ClientRedirect";
import Button from "@/components/ui/Button";
import ScrollReveal from "@/components/ui/ScrollReveal";
import {
  LuCalendarDays,
  LuTag,
  LuBell,
  LuSparkles,
  LuCalendarRange,
  LuFileText,
} from "react-icons/lu";

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export async function generateMetadata() {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function Home() {
  const session = await auth();
  if (session) {
    const locale = await getLocale();
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("landing");

  const features = [
    { icon: LuSparkles, titleKey: "featureAITitle", descKey: "featureAIDesc" },
    { icon: LuCalendarDays, titleKey: "featureRecurringTitle", descKey: "featureRecurringDesc" },
    { icon: LuTag, titleKey: "featureTagsTitle", descKey: "featureTagsDesc" },
    { icon: LuBell, titleKey: "featureAlertsTitle", descKey: "featureAlertsDesc" },
    { icon: LuCalendarRange, titleKey: "featureCalendarTitle", descKey: "featureCalendarDesc" },
    { icon: LuFileText, titleKey: "featureNotesTitle", descKey: "featureNotesDesc" },
  ];

  const steps = [
    { num: "1", titleKey: "step1Title", descKey: "step1Desc" },
    { num: "2", titleKey: "step2Title", descKey: "step2Desc" },
    { num: "3", titleKey: "step3Title", descKey: "step3Desc" },
  ];

  return (
    <div
      className={`${dmSerif.variable} ${outfit.variable}`}
      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
    >
      <ClientRedirect />

      {/* Hero — centered, dramatic */}
      <section className="text-center pt-24 pb-20 px-6 md:pt-28 md:pb-24">
        <div
          className="w-14 h-14 mx-auto mb-7 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
            boxShadow: "0 8px 32px color-mix(in srgb, var(--primary) 25%, transparent)",
          }}
        >
          <LuBell className="w-7 h-7 text-text-inverted" />
        </div>
        <h1
          className="text-5xl md:text-6xl lg:text-[72px] leading-[1.05] tracking-tight mb-6 text-text-primary"
          style={{ fontFamily: "var(--font-dm-serif), serif", letterSpacing: "-0.03em" }}
        >
          {t("headline")}
        </h1>
        <p className="text-base md:text-lg lg:text-xl leading-relaxed font-light max-w-[520px] mx-auto mb-10 text-text-secondary">
          {t("subheadline")}
        </p>
        <Button
          href="/register"
          variant="primary"
          size="lg"
          className="text-base px-9 py-4 rounded-xl shadow-lg"
          style={{ boxShadow: "0 4px 20px color-mix(in srgb, var(--primary) 25%, transparent)" }}
        >
          {t("ctaButton")} <span className="ml-1">→</span>
        </Button>
        <p className="mt-3.5 text-[13px] text-text-muted">{t("noCreditCard")}</p>
      </section>

      {/* Features */}
      <ScrollReveal>
        <section className="py-20 px-6 max-w-[1080px] mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[2px] font-semibold text-primary mb-4">
              {t("capabilities")}
            </p>
            <h2
              className="text-3xl md:text-[40px] leading-tight text-text-primary"
              style={{ fontFamily: "var(--font-dm-serif), serif" }}
            >
              {t("featuresTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat) => (
              <div
                key={feat.titleKey}
                className="p-7 rounded-2xl text-center transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--primary-light)",
                    border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
                  }}
                >
                  <feat.icon className="w-[22px] h-[22px] text-primary" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {t(feat.titleKey)}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed font-light">
                  {t(feat.descKey)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* How it works */}
      <ScrollReveal>
        <section className="py-20 px-6 max-w-[860px] mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[2px] font-semibold text-primary mb-4">
              {t("howItWorks")}
            </p>
            <h2
              className="text-3xl md:text-[40px] leading-tight text-text-primary"
              style={{ fontFamily: "var(--font-dm-serif), serif" }}
            >
              {t("howItWorksTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step) => (
              <div
                key={step.num}
                className="text-center p-8 rounded-2xl"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="w-10 h-10 mx-auto mb-5 rounded-full bg-primary text-text-inverted flex items-center justify-center text-base font-bold">
                  {step.num}
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2.5">
                  {t(step.titleKey)}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed font-light">
                  {t(step.descKey)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal>
        <section className="relative py-24 px-6 text-center overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[480px] h-[480px] pointer-events-none"
            style={{
              background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 70%)",
            }}
          />
          <h2
            className="relative text-3xl md:text-[44px] leading-tight text-text-primary mb-4"
            style={{ fontFamily: "var(--font-dm-serif), serif" }}
          >
            {t("ctaTitle")}
          </h2>
          <p className="relative text-base md:text-[17px] text-text-secondary font-light mb-9">
            {t("ctaDesc")}
          </p>
          <Button
            href="/register"
            variant="primary"
            size="lg"
            className="relative text-base px-9 py-4 rounded-xl shadow-lg"
            style={{ boxShadow: "0 4px 20px color-mix(in srgb, var(--primary) 25%, transparent)" }}
          >
            {t("ctaButton")} <span className="ml-1">→</span>
          </Button>
        </section>
      </ScrollReveal>
    </div>
  );
}
