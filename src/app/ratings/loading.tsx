export default function RatingsLoading() {
  return (
    <div className="page-bg mx-auto max-w-6xl px-4 py-10">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-white/10" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
