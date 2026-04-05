import Footer from "@/components/layout/Footer";

export default function MarketingLayout({ children }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1">{children}</div>
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}
