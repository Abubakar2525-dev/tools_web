/** Placeholder shown while a tool's code chunk loads (reserves space to avoid layout shift). */
export function ToolLoading() {
  return (
    <div className="card grid min-h-[360px] place-items-center p-8" role="status">
      <span className="inline-flex items-center gap-2 text-sm text-ink-2">
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent motion-reduce:animate-none" />
        Loading tool…
      </span>
    </div>
  );
}
