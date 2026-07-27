"use client";

import { useEffect } from "react";
import { RefreshCw, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const databaseUnavailable =
    error.name === "DatabaseUnavailableError" ||
    error.message.includes("could not reach its database");

  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="bg-primary/10 mx-auto mb-5 grid size-12 place-items-center rounded-full">
          <Sprout className="text-primary size-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold">
          {databaseUnavailable
            ? "Your workspace is temporarily unavailable"
            : "Something interrupted this page"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {databaseUnavailable
            ? "Your sign-in succeeded, but LUMII could not reach the study database. Your account is safe—please try again in a moment."
            : "Nothing was deleted. Try loading the page again."}
        </p>
        <Button className="mt-6 gap-2" onClick={reset}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      </Card>
    </main>
  );
}
