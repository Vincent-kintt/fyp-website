// hooks/useVirtualKeyboard.js
"use client";

import { useEffect, useState } from "react";

/**
 * Detects whether the virtual keyboard is open on mobile.
 * Uses window.visualViewport resize events.
 * Returns false on SSR and on browsers that don't support visualViewport.
 */
export function useVirtualKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handler = () => {
      const heightDiff = window.innerHeight - viewport.height;
      setIsKeyboardOpen(heightDiff > 150);
    };

    viewport.addEventListener("resize", handler);
    return () => viewport.removeEventListener("resize", handler);
  }, []);

  return isKeyboardOpen;
}
