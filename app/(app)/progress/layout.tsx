import type { ReactNode } from "react";
import { ProgressNav } from "@/components/progress/progress-nav";

export default function ProgressLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <ProgressNav />
      </div>
      {children}
    </div>
  );
}
