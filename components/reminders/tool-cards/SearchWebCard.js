"use client";

import { Card, t } from "./shared";

export default function SearchWebCard({ result, language }) {
  const r = result.results?.[0];
  if (!r) return null;
  return (
    <Card accent="default">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: "14px" }}>🌐</span>
        <span className="font-semibold text-sm" style={{ color: "var(--modal-text)" }}>
          {t(language, "搜尋結果", "Search Results")}
        </span>
      </div>
      <div className="rounded-md p-2.5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div style={{ fontSize: "12px", color: "var(--modal-text-secondary)", lineHeight: "1.5" }}>
          {r.snippet?.length > 300 ? r.snippet.slice(0, 300) + "..." : r.snippet}
        </div>
      </div>
      {r.citations?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.citations.slice(0, 3).map((url, i) => {
            let domain;
            try { domain = new URL(url).hostname.replace("www.", ""); } catch { domain = url; }
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="rounded-full px-2 py-0.5 inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ fontSize: "10px", color: "var(--primary)", background: "var(--modal-accent-light)", border: "1px solid var(--modal-accent-border)" }}>
                [{i + 1}] {domain}
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}
