import { LumenSpark } from "@/components/lumen-spark";

/** Placeholder empty-state for pages that are not built out yet. */
export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <LumenSpark className="size-10 opacity-80" />
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        {description ?? "This area is coming together."}
      </p>
    </div>
  );
}
