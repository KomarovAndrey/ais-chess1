export default function GlobalLoading() {
  return (
    <div className="page-bg flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        <p className="text-sm text-white/45">Загрузка…</p>
      </div>
    </div>
  );
}
