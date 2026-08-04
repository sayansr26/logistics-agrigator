export function QuoteSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        Querying partner rates across networks...
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-card rounded-2xl p-5 border border-border shadow-sm animate-pulse space-y-4"
          >
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/3" />
            <div className="h-10 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
