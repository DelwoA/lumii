"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requestUpload, finalizeUpload } from "@/app/(app)/materials/actions";
import { MAX_FILE_BYTES, PDF_CONTENT_TYPE } from "@/lib/validations/material";

export function MaterialUploadDialog({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const subjectId = (form.get("subjectId") as string) || undefined;
    const file = fileRef.current?.files?.[0];

    if (!file) return toast.error("Choose a PDF file");
    if (file.type !== PDF_CONTENT_TYPE)
      return toast.error("Only PDF files are supported");
    if (file.size > MAX_FILE_BYTES)
      return toast.error("File must be 10 MB or less");

    setBusy(true);
    try {
      const res = await requestUpload({
        title,
        subjectId,
        fileName: file.name,
        contentType: PDF_CONTENT_TYPE,
        sizeBytes: file.size,
      });
      if (!res.ok) return toast.error(res.error);

      const put = await fetch(res.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": PDF_CONTENT_TYPE },
      });
      if (!put.ok) return toast.error("Upload failed. Please try again.");

      const fin = await finalizeUpload(res.materialId);
      if (!fin.ok) return toast.error(fin.error ?? "File failed validation");

      toast.success("Material uploaded");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong during upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Upload className="size-4" />
            Upload PDF
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Upload a PDF</DialogTitle>
            <DialogDescription>
              Lecture slides or notes, up to 10 MB.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="m-title">Title</Label>
              <Input
                id="m-title"
                name="title"
                required
                maxLength={120}
                placeholder="e.g. Week 3: Scheduling"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-file">PDF file</Label>
              <Input
                id="m-file"
                ref={fileRef}
                type="file"
                accept="application/pdf"
                required
              />
            </div>
            {subjects.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="m-subject">Subject (optional)</Label>
                <select
                  id="m-subject"
                  name="subjectId"
                  className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="">None</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
