export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="skeleton-line h-7 w-32" />
        <div className="skeleton-line h-4 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 space-y-2">
            <div className="skeleton-line h-3 w-16" />
            <div className="skeleton-line h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="skeleton-line w-5 h-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-line h-4 w-3/4" />
              <div className="skeleton-line h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
