import { cn } from "@/lib/utils";

/**
 * The LUMII signature mark: a four-ray "lumen" spark.
 * Uses currentColor so it inherits the lime accent (text-primary) or any color.
 */
export function LumenSpark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-6 text-primary", className)}
    >
      <path
        d="M12 1.5c.5 5.4 2.6 7.6 8 8.1-5.4.5-7.5 2.7-8 8.1-.5-5.4-2.6-7.6-8-8.1 5.4-.5 7.5-2.7 8-8.1Z"
        fill="currentColor"
      />
    </svg>
  );
}
