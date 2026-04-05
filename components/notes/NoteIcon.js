"use client";

import { useTheme } from "next-themes";
import { File } from "lucide-react";
import { getIconComponent, getIconColor } from "@/lib/notes/iconMap";

export default function NoteIcon({
  icon,
  hasChildren,
  expanded,
  size = 15,
  fallbackOpacity = 0.6,
}) {
  const { theme } = useTheme();

  if (icon?.name) {
    const Icon = getIconComponent(icon.name);
    const color = getIconColor(icon.color, theme);
    return <Icon size={size} strokeWidth={1.5} style={{ color }} />;
  }

  const FallbackIcon = File;
  return (
    <FallbackIcon
      size={size}
      strokeWidth={1.5}
      style={{ color: "var(--text-muted)", opacity: fallbackOpacity }}
    />
  );
}
