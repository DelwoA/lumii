"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  requestUpload,
  finalizeUpload,
  startMultipartUpload,
  completeUpload,
  abortUpload,
} from "@/app/(app)/materials/actions";
import {
  MAX_FILE_BYTES,
  MULTIPART_THRESHOLD,
  PDF_CONTENT_TYPE,
} from "@/lib/validations/material";
import { uploadParts } from "@/lib/storage/multipart-upload";

const MAX_FILE_MB = Math.floor(MAX_FILE_BYTES / (1024 * 1024));

type UploadArgs = { title: string; subjectId?: string; file: File };

export function MaterialUploadDialog({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Percent (0-100) during a multipart upload; null when there is no granular
  // progress to show (idle, or the single-PUT fast path).
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Single-PUT fast path for small files. Toasts + returns false on failure. */
  async function uploadSingle({ title, subjectId, file }: UploadArgs) {
    const res = await requestUpload({
      title,
      subjectId,
      fileName: file.name,
      contentType: PDF_CONTENT_TYPE,
      sizeBytes: file.size,
    });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    const put = await fetch(res.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": PDF_CONTENT_TYPE },
    });
    if (!put.ok) {
      toast.error("Upload failed. Please try again.");
      return false;
    }
    const fin = await finalizeUpload(res.materialId);
    if (!fin.ok) {
      toast.error(fin.error ?? "File failed validation");
      return false;
    }
    return true;
  }

  /** Resumable multipart path for large files. Aborts the upload on failure. */
  async function uploadMultipart({ title, subjectId, file }: UploadArgs) {
    const res = await startMultipartUpload({
      title,
      subjectId,
      fileName: file.name,
      contentType: PDF_CONTENT_TYPE,
      sizeBytes: file.size,
    });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setProgress(0);
    try {
      const parts = await uploadParts({
        file,
        partUrls: res.partUrls,
        partSize: res.partSize,
        onProgress: (done, total) =>
          setProgress(Math.round((done / total) * 100)),
      });
      const fin = await completeUpload({
        materialId: res.materialId,
        uploadId: res.uploadId,
        parts,
      });
      if (!fin.ok) {
        toast.error(fin.error ?? "File failed validation");
        return false;
      }
      return true;
    } catch {
      await abortUpload({
        materialId: res.materialId,
        uploadId: res.uploadId,
      }).catch(() => {});
      toast.error("Upload failed. Please try again.");
      return false;
    }
  }

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
      return toast.error(`File must be ${MAX_FILE_MB} MB or less`);

    setBusy(true);
    setProgress(null);
    try {
      const args = { title, subjectId, file };
      const ok =
        file.size > MULTIPART_THRESHOLD
          ? await uploadMultipart(args)
          : await uploadSingle(args);
      if (!ok) return;
      toast.success("Material uploaded");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong during upload");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const buttonLabel = busy
    ? progress !== null
      ? `Uploading ${progress}%`
      : "Uploading…"
    : "Upload";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't let the dialog close mid-upload and orphan an in-flight upload.
        if (!busy) setOpen(next);
      }}
    >
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
              Lecture slides or notes, up to {MAX_FILE_MB} MB.
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
            {progress !== null && (
              <div className="grid gap-1.5">
                <Progress value={progress} />
                <p className="text-muted-foreground text-xs">
                  Uploading large file… {progress}%
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {buttonLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
