"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reminderKeys } from "@/lib/queryKeys";
import AIReminderModal from "@/components/reminders/AIReminderModal";

const AIModalContext = createContext(null);

export function useAIModal() {
  const ctx = useContext(AIModalContext);
  if (!ctx) throw new Error("useAIModal must be used within AIModalProvider");
  return ctx;
}

export default function AIModalProvider({ children }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [initialText, setInitialText] = useState("");

  const open = useCallback((text = "") => {
    setInitialText(text);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setInitialText("");
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) setInitialText("");
      return !prev;
    });
  }, []);

  // Global Cmd+J shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: reminderKeys.all });
  }, [queryClient]);

  return (
    <AIModalContext.Provider value={{ open, close, toggle, isOpen }}>
      {children}
      <AIReminderModal
        isOpen={isOpen}
        onClose={close}
        onSuccess={handleSuccess}
        initialText={initialText}
      />
    </AIModalContext.Provider>
  );
}
