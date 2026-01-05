"use client";

import { FaRobot, FaPlus } from "react-icons/fa";
import { useState } from "react";

export default function FloatingActionButton({ onClick, onQuickAdd }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 lg:hidden">
      {/* Main FAB */}
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        aria-label="Open AI Assistant"
      >
        <FaRobot className="w-6 h-6" />
      </button>
    </div>
  );
}
