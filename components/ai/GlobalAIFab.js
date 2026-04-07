"use client";

import FloatingActionButton from "@/components/ui/FloatingActionButton";
import { useAIModal } from "@/components/ai/AIModalProvider";

export default function GlobalAIFab() {
  const { open } = useAIModal();

  return <FloatingActionButton onClick={() => open()} />;
}
