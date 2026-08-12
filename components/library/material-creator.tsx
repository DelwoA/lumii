"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  FileAudio,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  PenLine,
  Plus,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  createOrganizerSubject,
  createOrganizerTopic,
} from "@/app/(app)/subjects/actions";
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
type SubjectOption = { id: string; name: string; topics: TopicOption[] };
type DropState = "idle" | "active" | "accepted" | "rejected";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function titleFromFilename(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const [mode, setMode] = useState<"file" | "note">("file");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [note, setNote] = useState("");
  const [dropState, setDropState] = useState<DropState>("idle");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [uploadCancelable, setUploadCancelable] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);

  const topics = useMemo(
    () => subjects.find((subject) => subject.id === subjectId)?.topics ?? [],
    [subjects, subjectId],
  );

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
    if (!titleEdited) setTitle(titleFromFilename(next.name));
  }

  async function addSubject() {
    if (!newSubject.trim()) return;
    setCreatingSubject(true);
    const result = await createOrganizerSubject({ name: newSubject });
    setCreatingSubject(false);
    if (!result.ok) return toast.error(result.error);
    const subject = { id: result.id, name: result.name, topics: [] };
    setSubjects((current) => [...current, subject]);
    setSubjectId(subject.id);
    setTopicId("");
    setNewSubject("");
    toast.success("Subject created and selected");
  }

  async function addTopic() {
    if (!subjectId || !newTopic.trim()) return;
    setCreatingTopic(true);
    const result = await createOrganizerTopic({ subjectId, name: newTopic });
    setCreatingTopic(false);
    if (!result.ok) return toast.error(result.error);
    setSubjects((current) =>
      current.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              topics: [...subject.topics, { id: result.id, name: result.name }],
            }
          : subject,
      ),
    );
    setTopicId(result.id);
    setNewTopic("");
    toast.success("Topic created and selected");
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
      title: title.trim(),
      subjectId,
      topicId,
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
    if (!title.trim()) return toast.error("Add a title");
    if (!subjectId) return toast.error("Choose a subject");
    if (!topicId) return toast.error("Choose a topic");
    setBusy(true);
    setProgress(null);
    try {
      let materialId: string;
      if (mode === "note") {
        if (!note.trim()) throw new Error("Write or paste your note");
        const form = new FormData();
        form.set("title", title);
        form.set("subjectId", subjectId);
        form.set("topicId", topicId);
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

  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedTopic = topics.find((topic) => topic.id === topicId);

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
          Add one file or typed note, then organize it for concept mapping.
        </p>
      </header>

      <ol
        className="bg-card grid grid-cols-4 overflow-hidden rounded-xl border"
        aria-label="Material setup steps"
      >
        {["Add Material", "Organize", "Map Concepts", "Quiz"].map(
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
            <div className="space-y-2">
              <Label htmlFor="material-title">Title</Label>
              <Input
                id="material-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleEdited(true);
                }}
                maxLength={120}
                placeholder={
                  mode === "file"
                    ? "Derived from the filename"
                    : "e.g. Week 3 revision notes"
                }
                disabled={busy}
              />
            </div>

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
              Required organization
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Where does this belong?
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Concepts and quizzes use the selected topic as their learning
              context.
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
                  setTopicId("");
                }}
                disabled={busy}
              >
                <SelectTrigger
                  id="creator-subject"
                  className="w-full"
                  aria-invalid={!subjectId}
                >
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  value={newSubject}
                  onChange={(event) => setNewSubject(event.target.value)}
                  placeholder="New subject name"
                  maxLength={60}
                  disabled={busy || creatingSubject}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Create subject"
                  onClick={addSubject}
                  disabled={!newSubject.trim() || busy || creatingSubject}
                >
                  {creatingSubject ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="creator-topic">Topic</Label>
              <Select
                value={topicId || null}
                items={Object.fromEntries(
                  topics.map((topic) => [topic.id, topic.name]),
                )}
                onValueChange={(value) => setTopicId(value ?? "")}
                disabled={!subjectId || busy}
              >
                <SelectTrigger
                  id="creator-topic"
                  className="w-full"
                  aria-invalid={Boolean(subjectId && !topicId)}
                >
                  <SelectValue
                    placeholder={
                      subjectId ? "Choose a topic" : "Choose a subject first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  value={newTopic}
                  onChange={(event) => setNewTopic(event.target.value)}
                  placeholder="New topic name"
                  maxLength={60}
                  disabled={!subjectId || busy || creatingTopic}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Create topic"
                  onClick={addTopic}
                  disabled={
                    !subjectId || !newTopic.trim() || busy || creatingTopic
                  }
                >
                  {creatingTopic ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            {selectedSubject && selectedTopic ? (
              <div className="bg-secondary/45 flex gap-2 rounded-lg p-3 text-sm">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {selectedSubject.name} › {selectedTopic.name}
                </span>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                onClick={save}
                disabled={
                  busy ||
                  !subjectId ||
                  !topicId ||
                  !title.trim() ||
                  (mode === "file" ? !file : !note.trim())
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
                  : "Continue to Map Concepts"}
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
