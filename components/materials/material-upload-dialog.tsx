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
  transcribeAudioAction,
} from "@/app/(app)/materials/actions";
import {
  MAX_FILE_BYTES,
  MULTIPART_THRESHOLD,
  UPLOAD_ACCEPT_ATTR,
  UPLOAD_CONTENT_TYPES,
  UPLOAD_TYPES_LABEL,
  AUDIO_SINGLE_CALL_MAX_SEC,
  AUDIO_SINGLE_CALL_MAX_BYTES,
  isAudioContentType,
  type UploadContentType,
} from "@/lib/validations/material";
import { uploadParts } from "@/lib/storage/multipart-upload";

const MAX_FILE_MB = Math.floor(MAX_FILE_BYTES / (1024 * 1024));
const AUDIO_MAX_MIN = Math.floor(AUDIO_SINGLE_CALL_MAX_SEC / 60);
const AUDIO_MAX_MB = Math.floor(AUDIO_SINGLE_CALL_MAX_BYTES / (1024 * 1024));

function isAcceptedType(type: string): type is UploadContentType {
  return (UPLOAD_CONTENT_TYPES as readonly string[]).includes(type);
}

/** Read an audio clip's duration in seconds (null if the browser can't tell). */
function readAudioDurationSec(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

type UploadArgs = {
  title: string;
  subjectId?: string;
  file: File;
  contentType: UploadContentType;
};

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
  // True while an uploaded audio clip is being transcribed by the model.
  const [transcribing, setTranscribing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Single-PUT fast path for small files. Returns the materialId, or null. */
  async function uploadSingle({
    title,
    subjectId,
    file,
    contentType,
  }: UploadArgs): Promise<string | null> {
    const res = await requestUpload({
      title,
      subjectId,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    });
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    const put = await fetch(res.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });
    if (!put.ok) {
      toast.error("Upload failed. Please try again.");
      return null;
    }
    const fin = await finalizeUpload(res.materialId);
    if (!fin.ok) {
      toast.error(fin.error ?? "File failed validation");
      return null;
    }
    return res.materialId;
  }

  /** Resumable multipart path for large files. Returns the materialId, or null. */
  async function uploadMultipart({
    title,
    subjectId,
    file,
    contentType,
  }: UploadArgs): Promise<string | null> {
    const res = await startMultipartUpload({
      title,
      subjectId,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    });
    if (!res.ok) {
      toast.error(res.error);
      return null;
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
        // Clean up the in-progress upload if completion itself failed (a no-op
        // server-side if the object was already completed but failed validation).
        await abortUpload({
          materialId: res.materialId,
          uploadId: res.uploadId,
        }).catch(() => {});
        toast.error(fin.error ?? "File failed validation");
        return null;
      }
      return res.materialId;
    } catch {
      await abortUpload({
        materialId: res.materialId,
        uploadId: res.uploadId,
      }).catch(() => {});
      toast.error("Upload failed. Please try again.");
      return null;
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const subjectId = (form.get("subjectId") as string) || undefined;
    const file = fileRef.current?.files?.[0];

    if (!file) return toast.error("Choose a file to upload");
    if (!isAcceptedType(file.type))
      return toast.error("Only PDF, image, or audio files are supported");
    if (file.size > MAX_FILE_BYTES)
      return toast.error(`File must be ${MAX_FILE_MB} MB or less`);

    const isAudio = isAudioContentType(file.type);
    if (isAudio) {
      // Single-call transcription must fit the function budget, so cap length.
      if (file.size > AUDIO_SINGLE_CALL_MAX_BYTES)
        return toast.error(
          `Audio must be ${AUDIO_MAX_MB} MB or less for now (longer audio is coming)`,
        );
      const duration = await readAudioDurationSec(file);
      if (duration !== null && duration > AUDIO_SINGLE_CALL_MAX_SEC)
        return toast.error(
          `Audio must be ${AUDIO_MAX_MIN} minutes or less for now (longer audio is coming)`,
        );
    }

    setBusy(true);
    setProgress(null);
    try {
      const args: UploadArgs = { title, subjectId, file, contentType: file.type };
      const materialId =
        file.size > MULTIPART_THRESHOLD
          ? await uploadMultipart(args)
          : await uploadSingle(args);
      if (!materialId) return;

      if (isAudio) {
        setTranscribing(true);
        const t = await transcribeAudioAction(materialId);
        setTranscribing(false);
        if (t.ok) {
          toast.success("Audio uploaded and transcribed");
        } else {
          // The file is saved (marked failed); the material page offers a retry.
          toast.error(t.error ?? "Could not transcribe the audio");
        }
      } else {
        toast.success("Material uploaded");
      }
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong during upload");
    } finally {
      setBusy(false);
      setProgress(null);
      setTranscribing(false);
    }
  }

  const buttonLabel = transcribing
    ? "Transcribing…"
    : busy
      ? progress !== null
        ? `Uploading ${progress}%`
        : "Uploading…"
      : "Upload";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't let the dialog close mid-upload/transcription and orphan it.
        if (!busy && !transcribing) setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Upload className="size-4" />
            Upload file
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Upload a file</DialogTitle>
            <DialogDescription>
              {UPLOAD_TYPES_LABEL}, up to {MAX_FILE_MB} MB.
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
              <Label htmlFor="m-file">File</Label>
              <Input
                id="m-file"
                ref={fileRef}
                type="file"
                accept={UPLOAD_ACCEPT_ATTR}
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
            <Button type="submit" disabled={busy || transcribing}>
              {buttonLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
