"use client";

import { useState, useEffect } from "react";
import FloatingActionButton from "@/components/ui/FloatingActionButton";
import AIReminderModal from "@/components/reminders/AIReminderModal";

export default function GlobalAIFab() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-ai-modal", handler);
    return () => window.removeEventListener("open-ai-modal", handler);
  }, []);

  return (
    <>
      <FloatingActionButton onClick={() => setIsOpen(true)} />
      <AIReminderModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new Event("ai-reminder-changed"));
        }}
      />
    </>
  );
}
