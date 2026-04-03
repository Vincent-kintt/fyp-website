import GlobalAIFab from "@/components/ai/GlobalAIFab";

export default function AppLayout({ children }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
      <GlobalAIFab />
    </div>
  );
}
