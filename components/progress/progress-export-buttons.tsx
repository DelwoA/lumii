"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getProgressExportAction } from "@/app/(app)/progress/actions";
import type { ProgressFilters } from "@/lib/progress/types";
import { sessionsCsv } from "@/lib/progress/csv";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProgressExportButtons({
  filters,
}: {
  filters: ProgressFilters;
}) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [includeReflections, setIncludeReflections] = useState(false);

  async function exportCsv() {
    setBusy("csv");
    try {
      const report = await getProgressExportAction(filters);
      download(
        new Blob([sessionsCsv(report.sessions)], {
          type: "text/csv;charset=utf-8",
        }),
        "lumii-session-history.csv",
      );
    } catch {
      toast.error("Could not create the CSV");
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      const report = await getProgressExportAction(filters);
      const [{ pdf }, { ProgressReportDocument }, React] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/progress-report-pdf"),
        import("react"),
      ]);
      const document = React.createElement(ProgressReportDocument, {
        ...report,
        includeReflections,
      });
      const blob = await pdf(document as Parameters<typeof pdf>[0]).toBlob();
      download(blob, "lumii-progress-report.pdf");
    } catch {
      toast.error("Could not create the PDF report");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={exportCsv}
        disabled={busy !== null}
      >
        <Download className="size-4" aria-hidden="true" />
        {busy === "csv" ? "Preparing…" : "CSV history"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={exportPdf}
        disabled={busy !== null}
      >
        <FileText className="size-4" aria-hidden="true" />
        {busy === "pdf" ? "Preparing…" : "PDF report"}
      </Button>
      <div className="ml-1 flex items-center gap-2">
        <Checkbox
          id="include-reflections"
          checked={includeReflections}
          onCheckedChange={(value) => setIncludeReflections(value === true)}
        />
        <Label htmlFor="include-reflections" className="text-xs font-normal">
          Include private reflections
        </Label>
      </div>
    </div>
  );
}
