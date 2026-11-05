"use client";

import Link from "next/link";
import {
  useEffect,
  useActionState,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Plus,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { ActionForm } from "@/components/shared/action-form";
import { TextField, LongField } from "@/components/shared/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { uploadCourse, createSubject } from "./actions";
import type { Subject } from "./types";

const MAX_FILES = 10;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED_FILE = /\.(pdf|txt|md)$/i;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function UploadForm({
  subjects,
  institutions = [],
}: {
  subjects: Subject[];
  institutions?: Array<{ id: string; name: string }>;
}) {
  const [formVersion, setFormVersion] = useState(0);
  const [subjectOptions, setSubjectOptions] = useState(subjects);
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    subjects[0]?.id || "",
  );
  const [subjectNotice, setSubjectNotice] = useState("");
  const [filesNeedReview, setFilesNeedReview] = useState(false);
  const [newSubjectRequested, setNewSubjectRequested] = useState(false);

  function handleSubjectCreated(subject: Subject) {
    setSubjectOptions((current) =>
      current.some((item) => item.id === subject.id)
        ? current
        : [subject, ...current],
    );
    setSelectedSubjectId(subject.id);
    setFilesNeedReview(false);
    setNewSubjectRequested(false);
    setSubjectNotice(`${subject.name} is ready and selected for this course.`);
  }

  if (!subjectOptions.length)
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          First, create a subject to organize your course material.
        </p>
        <SubjectForm onCreated={handleSubjectCreated} />
      </div>
    );

  return (
    <CourseUploader
      key={formVersion}
      subjects={subjectOptions}
      institutions={institutions}
      selectedSubjectId={selectedSubjectId}
      onSubjectChange={(subjectId) => {
        if (subjectId !== selectedSubjectId) setFilesNeedReview(true);
        setSelectedSubjectId(subjectId);
      }}
      onSwitchCourse={() => {
        const next = subjectOptions.find(
          (subject) => subject.id !== selectedSubjectId,
        );
        setSelectedSubjectId(next?.id || "");
        setFilesNeedReview(false);
        setNewSubjectRequested(!next);
        setSubjectNotice(
          next
            ? next.name + " is selected for your next course."
            : "Create a subject for your next course.",
        );
        setFormVersion((version) => version + 1);
      }}
      onSubjectCreated={handleSubjectCreated}
      startWithNewSubject={newSubjectRequested}
      filesNeedReview={filesNeedReview}
      subjectNotice={subjectNotice}
      onUploadAnother={() => {
        setSubjectNotice("");
        setFormVersion((version) => version + 1);
      }}
    />
  );
}

function CourseUploader({
  subjects,
  institutions,
  selectedSubjectId,
  onSubjectChange,
  onSwitchCourse,
  onSubjectCreated,
  startWithNewSubject,
  filesNeedReview,
  subjectNotice,
  onUploadAnother,
}: {
  subjects: Subject[];
  institutions: Array<{ id: string; name: string }>;
  selectedSubjectId: string;
  onSubjectChange: (subjectId: string) => void;
  onSwitchCourse: () => void;
  onSubjectCreated: (subject: Subject) => void;
  startWithNewSubject: boolean;
  filesNeedReview: boolean;
  subjectNotice: string;
  onUploadAnother: () => void;
}) {
  const [state, formAction, pending] = useActionState(uploadCourse, {});
  const [selected, setSelected] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [subjectDialogOpen, setSubjectDialogOpen] =
    useState(startWithNewSubject);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const totalBytes = selected.reduce((sum, file) => sum + file.size, 0);

  function syncFiles(files: File[]) {
    setSelected(files);
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
  }

  function addFiles(incoming: File[]) {
    const next = [...selected];
    const skipped: string[] = [];
    let total = totalBytes;

    for (const file of incoming) {
      if (next.some((item) => fileKey(item) === fileKey(file))) continue;
      if (!ACCEPTED_FILE.test(file.name)) {
        skipped.push(`${file.name} is not a PDF, TXT or Markdown file`);
        continue;
      }
      if (!file.size) {
        skipped.push(`${file.name} is empty`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        skipped.push(`You can add up to ${MAX_FILES} files at a time`);
        break;
      }
      if (total + file.size > MAX_UPLOAD_BYTES) {
        skipped.push(`${file.name} would take the upload over 25 MB`);
        continue;
      }
      next.push(file);
      total += file.size;
    }

    setSelectionError(skipped.length ? skipped[0] : "");
    syncFiles(next);
  }

  function openPicker() {
    if (!pending) inputRef.current?.click();
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (pending) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (pending) return;
    addFiles(Array.from(event.dataTransfer.files));
  }

  function createSubject(subject: Subject) {
    setSubjectDialogOpen(false);
    onSubjectCreated(subject);
  }

  if (state.destination) {
    return (
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b bg-secondary/50 px-6 py-7 sm:px-8">
          <div className="flex size-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="size-6" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            Course uploaded
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Noveris has accepted your sources and is preparing the course. You
            can leave this page; processing will continue in the background.
          </p>
        </div>
        <div className="flex flex-col gap-3 p-6 sm:p-8">
          <Button asChild size="lg" className="justify-between">
            <Link href={state.destination}>
              Open course and check progress
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={onUploadAnother}>
              <UploadCloud data-icon="inline-start" />
              Upload another course
            </Button>
            <Button asChild variant="ghost">
              <Link href="/courses">View all courses</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSwitchCourse}
              className="sm:col-span-2"
            >
              Start in another subject
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <form action={formAction} className="flex flex-col gap-6">
        <fieldset disabled={pending} className="flex flex-col gap-5">
          <FieldGroup className="rounded-2xl border bg-card p-5 sm:p-6">
            <TextField
              label="Course title"
              name="title"
              required
              maxLength={150}
              placeholder="e.g. Limits and continuity"
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="subject_id">Subject</FieldLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSubjectDialogOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={subjectDialogOpen}
                  >
                    <Plus data-icon="inline-start" />
                    New subject
                  </Button>
                </div>
                <NativeSelect
                  name="subject_id"
                  id="subject_id"
                  required
                  className="w-full"
                  value={selectedSubjectId}
                  onChange={(event) => onSubjectChange(event.target.value)}
                  aria-describedby={pending ? undefined : "subject-switch-note"}
                >
                  {subjects.map((subject) => (
                    <NativeSelectOption key={subject.id} value={subject.id}>
                      {subject.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p
                  id="subject-switch-note"
                  className="text-xs leading-5 text-muted-foreground"
                >
                  Switching subject keeps the form; choose the correct files for
                  this subject before uploading.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="institutionId">Who is this course for?</FieldLabel>
                <NativeSelect
                  id="institutionId"
                  name="institutionId"
                  defaultValue={institutions[0]?.id || ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">Private study — only me</NativeSelectOption>
                  {institutions.map((institution) => (
                    <NativeSelectOption
                      key={institution.id}
                      value={institution.id}
                    >
                      Students at {institution.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">Choose your institution to invite students after publishing. Private material cannot be shared with a class.</p>
                {institutions.length === 0 && <p className="text-xs text-muted-foreground">Teaching a class? Ask your institution administrator to add you as an instructor first.</p>}
              </Field>
            </div>
            <LongField
              label="Description (optional)"
              name="description"
              maxLength={2000}
              placeholder="Add a short note about this course."
            />
          </FieldGroup>

          <section
            className="flex flex-col gap-4"
            aria-labelledby="sources-heading"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="sources-heading" className="font-semibold">
                  Add your source files
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  PDF, TXT or Markdown · up to 10 files · 25 MB total
                </p>
              </div>
              {selected.length > 0 && (
                <Badge variant="secondary">
                  {selected.length} {selected.length === 1 ? "file" : "files"}
                </Badge>
              )}
            </div>

            <input
              ref={inputRef}
              id="files"
              name="files"
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              multiple
              required
              tabIndex={-1}
              className="sr-only"
              onChange={(event) => {
                addFiles(Array.from(event.target.files || []));
              }}
            />

            <button
              type="button"
              onClick={openPicker}
              onDragEnter={handleDragEnter}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              aria-describedby="source-file-help"
              className={`group flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                dragging
                  ? "scale-[1.01] border-primary bg-secondary"
                  : "border-border bg-muted/25 hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <span
                className={`flex size-12 items-center justify-center rounded-full transition-colors ${
                  dragging
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                }`}
              >
                <UploadCloud className="size-6" />
              </span>
              <span className="mt-4 text-base font-semibold">
                {dragging
                  ? "Drop your files here"
                  : "Drag and drop your course files"}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                or{" "}
                <span className="font-medium text-primary">choose files</span>{" "}
                from your device
              </span>
              {selected.length > 0 && (
                <span className="mt-2 text-xs text-muted-foreground">
                  Drop more files here to add them
                </span>
              )}
            </button>
            <p
              id="source-file-help"
              className="text-xs leading-5 text-muted-foreground"
            >
              Your originals stay private. You can remove a file before
              uploading.
            </p>

            {selected.length > 0 && (
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3 text-xs text-muted-foreground">
                  <span>{formatBytes(totalBytes)} total</span>
                  <button
                    type="button"
                    onClick={() => {
                      syncFiles([]);
                      setSelectionError("");
                    }}
                    className="font-medium text-foreground hover:text-destructive"
                  >
                    Remove all
                  </button>
                </div>
                <ul className="divide-y" aria-label="Selected course files">
                  {selected.map((file) => (
                    <li
                      key={fileKey(file)}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {file.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatBytes(file.size)}
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => {
                          syncFiles(
                            selected.filter(
                              (item) => fileKey(item) !== fileKey(file),
                            ),
                          );
                          setSelectionError("");
                        }}
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </fieldset>

        {selectionError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{selectionError}</AlertDescription>
          </Alert>
        )}
        {subjectNotice && (
          <Alert role="status">
            <AlertDescription>{subjectNotice}</AlertDescription>
          </Alert>
        )}
        {selected.length > 0 && filesNeedReview && (
          <Alert>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Your files stay attached if you change subject. Check that they
                belong to the selected subject before uploading.
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  syncFiles([]);
                  setSelectionError("");
                }}
              >
                Clear files
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {state.error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center">
          <Button
            type="submit"
            size="lg"
            disabled={pending || !selected.length}
          >
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            {pending ? "Uploading course…" : "Upload and prepare course"}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/courses">Cancel</Link>
          </Button>
          <span className="text-xs text-muted-foreground sm:ml-auto">
            {selected.length
              ? "Ready to upload — you can return to your courses after this step."
              : "Add at least one source to continue."}
          </span>
        </div>
        {pending && (
          <p className="text-sm text-muted-foreground" role="status">
            Keep this page open while your files are being uploaded. Course
            processing will continue in the background after the upload
            finishes.
          </p>
        )}
      </form>
      {subjectDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target)
              setSubjectDialogOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-subject-title"
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl"
            onKeyDown={(event) => {
              if (event.key === "Escape") setSubjectDialogOpen(false);
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="new-subject-title" className="text-xl font-semibold">
                  Create a subject
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Use a subject to keep related courses together.
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Close subject dialog"
                onClick={() => setSubjectDialogOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="mt-6">
              <SubjectForm
                onCreated={createSubject}
                onCancel={() => setSubjectDialogOpen(false)}
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function SubjectForm({
  onCreated,
  onCancel,
  autoFocus = false,
}: {
  onCreated?: (subject: Subject) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createSubject, {});
  const notifiedSubject = useRef<string | null>(null);

  useEffect(() => {
    const subject = state.createdSubject;
    if (!subject || notifiedSubject.current === subject.id) return;
    notifiedSubject.current = subject.id;
    onCreated?.(subject);
  }, [onCreated, state.createdSubject]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FieldGroup>
        <fieldset disabled={pending} className="flex flex-col gap-5">
          <TextField
            label="Subject name"
            name="name"
            required
            maxLength={100}
            autoFocus={autoFocus}
            placeholder="e.g. Mathematics"
          />
          <LongField
            label="Description (optional)"
            name="description"
            maxLength={2000}
            placeholder="What will this subject cover?"
          />
        </fieldset>
      </FieldGroup>
      {state.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          {pending ? "Creating subject…" : "Create subject"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
