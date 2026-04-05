export default function NotesLoading() {
  return (
    <div className="flex h-full">
      {/* Sidebar skeleton (desktop only) */}
      <aside
        className="hidden md:flex flex-col"
        style={{
          width: 240,
          minWidth: 240,
          boxShadow: "1px 0 0 0 var(--border)",
          background: "var(--background-secondary)",
        }}
      >
        <div className="px-3 pt-3 pb-2">
          <div className="skeleton-line h-3 w-12" />
        </div>
        <div className="px-2 space-y-0.5">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="skeleton-line w-4 h-4 rounded" />
            <div className="skeleton-line h-3 w-24" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="skeleton-line w-4 h-4 rounded" />
            <div className="skeleton-line h-3 w-32" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 ml-5">
            <div className="skeleton-line w-4 h-4 rounded" />
            <div className="skeleton-line h-3 w-20" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="skeleton-line w-4 h-4 rounded" />
            <div className="skeleton-line h-3 w-28" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="skeleton-line w-4 h-4 rounded" />
            <div className="skeleton-line h-3 w-20" />
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 overflow-hidden" style={{ background: "var(--surface)" }}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-3"
          style={{ minHeight: 40, borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <div className="skeleton-line h-3 w-16" />
            <div className="skeleton-line h-3 w-3 rounded-full" />
            <div className="skeleton-line h-3 w-24" />
          </div>
          <div className="skeleton-line h-3 w-16" />
        </div>

        {/* Editor area */}
        <div className="mx-auto px-6 md:px-16 pt-6" style={{ maxWidth: 900 }}>
          {/* Icon */}
          <div style={{ paddingLeft: 54 }}>
            <div className="skeleton-line w-8 h-8 rounded-lg mb-2" />
          </div>
          {/* Title */}
          <div className="skeleton-line h-10 w-56 mb-6" style={{ borderRadius: 6 }} />
          {/* Content lines */}
          <div className="space-y-3" style={{ paddingLeft: 54 }}>
            <div className="skeleton-line h-4 w-full" />
            <div className="skeleton-line h-4 w-5/6" />
            <div className="skeleton-line h-4 w-3/5" />
            <div className="h-3" />
            <div className="skeleton-line h-4 w-full" />
            <div className="skeleton-line h-4 w-4/5" />
            <div className="skeleton-line h-4 w-2/3" />
          </div>
        </div>
      </main>
    </div>
  );
}
