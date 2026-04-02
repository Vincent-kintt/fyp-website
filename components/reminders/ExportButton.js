"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { FaDownload, FaSpinner, FaFileCsv, FaFileCode } from "react-icons/fa";

export default function ExportButton() {
  const t = useTranslations("export");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleExport(format) {
    setOpen(false);
    setLoading(true);
    try {
      const res = await fetch("/api/reminders");
      if (!res.ok) throw new Error("Failed to fetch reminders");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch");
      const reminders = json.data;

      const today = new Date().toISOString().split("T")[0];

      if (format === "json") {
        const blob = new Blob([JSON.stringify(reminders, null, 2)], {
          type: "application/json",
        });
        downloadBlob(blob, `reminders-export-${today}.json`);
      } else {
        const csv = buildCsv(reminders);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, `reminders-export-${today}.csv`);
      }
    } catch {
      alert(t("exportFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer"
        style={{
          backgroundColor: "var(--background-tertiary)",
          color: "var(--text-primary)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--surface-active)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--background-tertiary)";
        }}
      >
        {loading ? (
          <FaSpinner className="animate-spin" />
        ) : (
          <FaDownload />
        )}
        {t("export")}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-40 rounded-lg shadow-lg z-50 py-1 border"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors cursor-pointer"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FaFileCsv style={{ color: "var(--success)" }} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport("json")}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors cursor-pointer"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FaFileCode style={{ color: "var(--primary)" }} />
            JSON
          </button>
        </div>
      )}
    </div>
  );
}

function escapeCsvField(value) {
  if (value == null) return "";
  const str = String(value);
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r", "\n"];
  let safe = str;
  if (dangerousPrefixes.some((p) => str.startsWith(p))) {
    safe = "'" + str;
  }
  return '"' + safe.replace(/"/g, '""') + '"';
}

function buildCsv(reminders) {
  const header = "title,description,status,dateTime,tags,createdAt";
  const rows = reminders.map((r) =>
    [
      r.title,
      r.description,
      r.status,
      r.dateTime,
      Array.isArray(r.tags) ? r.tags.join(";") : "",
      r.createdAt,
    ]
      .map(escapeCsvField)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
