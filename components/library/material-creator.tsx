"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileAudio,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  PenLine,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  abortUpload,
  cancelPendingUpload,
  completeUpload,
  createNote,
  finalizeUpload,
  requestUpload,
  startMultipartUpload,
  transcribeAudioAction,
} from "@/app/(app)/materials/actions";
import {
  SubjectManagerDialog,
  type ManagedSubject,
} from "@/components/subjects/subject-manager-dialog";
import {
  AUDIO_SINGLE_CALL_MAX_BYTES,
  AUDIO_SINGLE_CALL_MAX_SEC,
  isAudioContentType,
  MAX_FILE_BYTES,
  MULTIPART_THRESHOLD,
  UPLOAD_ACCEPT_ATTR,
  UPLOAD_CONTENT_TYPES,
  type UploadContentType,
} from "@/lib/validations/material";
import { uploadParts } from "@/lib/storage/multipart-upload";
import { ACTION_INITIAL } from "@/lib/forms";

type TopicOption = { id: string; name: string };
type SubjectOption = ManagedSubject & { topics: TopicOption[] };
type DropState = "idle" | "active" | "accepted" | "rejected";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function acceptedType(type: string): type is UploadContentType {
  return (UPLOAD_CONTENT_TYPES as readonly string[]).includes(type);
}

async function audioDuration(file: File): Promise<number | null> {
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

export function MaterialCreator({
  initialSubjects,
  initialSubjectId,
  initialTopicId,
  source,
}: {
  initialSubjects: SubjectOption[];
  initialSubjectId: string | null;
  initialTopicId: string | null;
  source: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [contextTopicId, setContextTopicId] = useState(initialTopicId ?? "");
  const [mode, setMode] = useState<"file" | "note">("file");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [dropState, setDropState] = useState<DropState>("idle");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [uploadCancelable, setUploadCancelable] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  function chooseFile(next: File | null) {
    if (!next) return;
    if (!acceptedType(next.type) || next.size > MAX_FILE_BYTES) {
      setDropState("rejected");
      toast.error(
        next.size > MAX_FILE_BYTES
          ? "File must be 200 MB or less"
          : "Choose a PDF, PNG, JPEG, WebP, or supported audio file",
      );
      return;
    }
    setFile(next);
    setDropState("accepted");
  }

  async function validateFile(next: File) {
    if (!acceptedType(next.type)) {
      toast.error("Choose a PDF, PNG, JPEG, WebP, or supported audio file");
      return false;
    }
    if (next.size > MAX_FILE_BYTES) {
      toast.error("File must be 200 MB or less");
      return false;
    }
    if (isAudioContentType(next.type)) {
      if (next.size > AUDIO_SINGLE_CALL_MAX_BYTES) {
        toast.error("Audio must be 40 MB or less for now");
        return false;
      }
      const duration = await audioDuration(next);
      if (duration !== null && duration > AUDIO_SINGLE_CALL_MAX_SEC) {
        toast.error("Audio must be 20 minutes or less for now");
        return false;
      }
    }
    return true;
  }

  async function uploadFile(next: File) {
    const controller = new AbortController();
    abortRef.current = controller;
    setUploadCancelable(true);
    const payload = {
      subjectId,
      topicId: contextTopicId || undefined,
      fileName: next.name,
      contentType: next.type as UploadContentType,
      sizeBytes: next.size,
    };

    if (next.size > MULTIPART_THRESHOLD) {
      const started = await startMultipartUpload(payload);
      if (!started.ok) throw new Error(started.error);
      setProgress(0);
      try {
        const parts = await uploadParts({
          file: next,
          partUrls: started.partUrls,
          partSize: started.partSize,
          signal: controller.signal,
          onProgress: (complete, total) =>
            setProgress(Math.round((complete / total) * 100)),
        });
        const result = await completeUpload({
          materialId: started.materialId,
          uploadId: started.uploadId,
          parts,
        });
        if (!result.ok) throw new Error(result.error);
        return started.materialId;
      } catch (error) {
        await abortUpload({
          materialId: started.materialId,
          uploadId: started.uploadId,
        }).catch(() => {});
        throw error;
      }
    }

    const started = await requestUpload(payload);
    if (!started.ok) throw new Error(started.error);
    try {
      const response = await fetch(started.uploadUrl, {
        method: "PUT",
        body: next,
        headers: { "Content-Type": next.type },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Upload failed. Please try again.");
      const result = await finalizeUpload(started.materialId);
      if (!result.ok) throw new Error(result.error);
      return started.materialId;
    } catch (error) {
      await cancelPendingUpload(started.materialId).catch(() => {});
      throw error;
    }
  }

  async function save() {
    if (!subjectId) return toast.error("Choose a subject");
    setBusy(true);
    setProgress(null);
    try {
      let materialId: string;
      if (mode === "note") {
        if (!note.trim()) throw new Error("Write or paste your note");
        const form = new FormData();
        form.set("subjectId", subjectId);
        if (contextTopicId) form.set("topicId", contextTopicId);
        form.set("text", note);
        const result = await createNote(ACTION_INITIAL, form);
        if (!result.ok) throw new Error(result.error);
        materialId = result.materialId;
      } else {
        if (!file) throw new Error("Choose a file to upload");
        if (!(await validateFile(file))) return;
        materialId = await uploadFile(file);
        if (isAudioContentType(file.type)) {
          toast.message("Transcribing audio…");
          const result = await transcribeAudioAction(materialId);
          if (!result.ok) toast.error(result.error);
        }
      }
      toast.success(mode === "note" ? "Note added" : "Material added");
      router.push(`/library/materials/${materialId}?setup=concepts`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        toast.message("Upload cancelled and cleaned up");
      } else {
        toast.error(
          error instanceof Error ? error.message : "Could not add the material",
        );
      }
    } finally {
      setBusy(false);
      setCancelling(false);
      setProgress(null);
      abortRef.current = null;
      setUploadCancelable(false);
    }
  }

  function cancelUpload() {
    if (!abortRef.current) return;
    setCancelling(true);
    abortRef.current.abort();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
          {source === "topic"
            ? "Adding to a topic"
            : source === "subject"
              ? "Adding to a subject"
              : "New learning material"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Add Material
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Add one file or typed note. LUMII will name it and organize the topic
          with you.
        </p>
      </header>

      <ol
        className="bg-card grid grid-cols-4 overflow-hidden rounded-xl border"
        aria-label="Material setup steps"
      >
        {["Add Material", "AI Organizes", "Review", "Quick Quiz"].map(
          (step, index) => (
            <li
              key={step}
              aria-current={index === 0 ? "step" : undefined}
              className={`relative flex min-h-14 items-center gap-1.5 border-r px-2 text-[11px] font-medium last:border-r-0 sm:text-xs xl:gap-2 xl:px-4 xl:text-sm ${index === 0 ? "bg-primary text-primary-foreground" : index === 1 ? "bg-secondary/60" : "text-muted-foreground"}`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${index === 0 ? "bg-primary-foreground text-primary" : "border"}`}
              >
                {index + 1}
              </span>
              <span className="hidden truncate min-[460px]:block">{step}</span>
            </li>
          ),
        )}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)] lg:items-start">
        <Card className="p-5 sm:p-6">
          <div
            className="bg-muted mb-5 grid grid-cols-2 rounded-lg p-1"
            role="group"
            aria-label="Material source"
          >
            <Button
              type="button"
              variant={mode === "file" ? "default" : "ghost"}
              onClick={() => setMode("file")}
              disabled={busy}
            >
              <UploadCloud className="size-4" /> Upload file
            </Button>
            <Button
              type="button"
              variant={mode === "note" ? "default" : "ghost"}
              onClick={() => setMode("note")}
              disabled={busy}
            >
              <PenLine className="size-4" /> Typed note
            </Button>
          </div>

          <div className="space-y-5">
            {mode === "file" ? (
              <div className="space-y-3">
                <Label htmlFor="material-file">File</Label>
                <input
                  ref={inputRef}
                  id="material-file"
                  type="file"
                  accept={UPLOAD_ACCEPT_ATTR}
                  className="sr-only"
                  onChange={(event) =>
                    chooseFile(event.target.files?.[0] ?? null)
                  }
                  disabled={busy}
                />
                {!file ? (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDropState("active");
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropState("active");
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDropState("idle");
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      chooseFile(event.dataTransfer.files[0] ?? null);
                    }}
                    className={`focus-visible:ring-ring/40 flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-visible:ring-3 focus-visible:outline-none ${dropState === "active" ? "border-primary bg-secondary/55" : dropState === "rejected" ? "border-destructive bg-destructive/5" : "border-input bg-muted/25 hover:border-primary/60"}`}
                  >
                    <span className="bg-secondary grid size-12 place-items-center rounded-full">
                      <UploadCloud className="text-primary size-6" />
                    </span>
                    <span className="font-medium">
                      Drop a file here or browse
                    </span>
                    <span className="text-muted-foreground max-w-sm text-xs">
                      PDF, PNG, JPEG, WebP, or supported audio · up to 200 MB
                    </span>
                  </button>
                ) : (
                  <div className="bg-muted/25 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
                    <span className="bg-secondary grid size-11 shrink-0 place-items-center rounded-lg">
                      {file.type === "application/pdf" ? (
                        <FileText className="size-5" />
                      ) : file.type.startsWith("image/") ? (
                        <ImageIcon className="size-5" />
                      ) : (
                        <FileAudio className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {file.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {file.type || "Unknown type"} · {formatBytes(file.size)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                        disabled={busy}
                      >
                        <RefreshCw className="size-4" /> Replace
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          setDropState("idle");
                          if (inputRef.current) inputRef.current.value = "";
                        }}
                        disabled={busy}
                      >
                        <X className="size-4" /> Remove
                      </Button>
                    </div>
                  </div>
                )}
                <p className="sr-only" aria-live="polite">
                  {dropState === "accepted" && file
                    ? `${file.name} accepted`
                    : dropState === "rejected"
                      ? "File rejected"
                      : ""}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="material-note">Notes</Label>
                <Textarea
                  id="material-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={14}
                  maxLength={50000}
                  placeholder="Write or paste your study notes…"
                  disabled={busy}
                />
              </div>
            )}

            {progress !== null ? (
              <div className="space-y-2" aria-live="polite">
                <div className="flex justify-between text-xs">
                  <span>Uploading large file</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-5 sm:p-6 lg:sticky lg:top-20">
          <div className="mb-5">
            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              One quick choice
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Which subject is this for?
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              LUMII will suggest the topic and quiz concepts after reading the
              material.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="creator-subject">Subject</Label>
              <Select
                value={subjectId || null}
                items={Object.fromEntries(
                  subjects.map((subject) => [subject.id, subject.name]),
                )}
                onValueChange={(value) => {
                  setSubjectId(value ?? "");
                  setContextTopicId("");
                }}
                disabled={busy}
              >
                <SelectTrigger
                  id="creator-subject"
                  className="w-full"
                >
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  alignItemWithTrigger={false}
                  sideOffset={6}
                >
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SubjectManagerDialog
                subjects={subjects}
                selectedSubjectId={subjectId}
                disabled={busy}
                onCreated={(subject) => {
                  setSubjects((current) =>
                    [...current, subject].toSorted((a, b) =>
                      a.name.localeCompare(b.name),
                    ),
                  );
                  setSubjectId(subject.id);
                  setContextTopicId("");
                }}
                onRenamed={(subject) => {
                  setSubjects((current) =>
                    current
                      .map((item) => (item.id === subject.id ? subject : item))
                      .toSorted((a, b) => a.name.localeCompare(b.name)),
                  );
                }}
                onDeleted={(deletedSubjectId) => {
                  setSubjects((current) =>
                    current.filter((item) => item.id !== deletedSubjectId),
                  );
                  if (subjectId === deletedSubjectId) {
                    setSubjectId("");
                    setContextTopicId("");
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                onClick={save}
                disabled={
                  busy || !subjectId || (mode === "file" ? !file : !note.trim())
                }
                className="w-full"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {busy
                  ? cancelling
                    ? "Cancelling…"
                    : progress !== null
                      ? `Uploading ${progress}%`
                      : mode === "note"
                        ? "Saving…"
                        : "Uploading…"
                  : "Add & Analyze"}
              </Button>
              {busy && uploadCancelable ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelUpload}
                  disabled={cancelling}
                >
                  Cancel upload
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
