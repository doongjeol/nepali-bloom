export function LoadingSpinner({ label = "로딩 중..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

