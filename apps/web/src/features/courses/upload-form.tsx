import { ActionForm } from "@/components/shared/action-form";
import { TextField, LongField } from "@/components/shared/form-field";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { uploadCourse, createSubject } from "./actions";
import type { Subject } from "./types";
export function UploadForm({ subjects }: { subjects: Subject[] }) {
  if (!subjects.length)
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          First, create a subject to organize your course material.
        </p>
        <SubjectForm />
      </div>
    );
  return (
    <ActionForm action={uploadCourse} submit="Upload and process">
      <FieldGroup>
        <TextField label="Course title" name="title" required maxLength={150} />
        <Field>
          <FieldLabel htmlFor="subject_id">Subject</FieldLabel>
          <NativeSelect name="subject_id" id="subject_id" required>
            {subjects.map((subject) => (
              <NativeSelectOption key={subject.id} value={subject.id}>
                {subject.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <LongField
          label="Description (optional)"
          name="description"
          maxLength={2000}
        />
        <Field>
          <FieldLabel htmlFor="files">Source documents</FieldLabel>
          <Input
            id="files"
            name="files"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            required
          />
          <FieldDescription>
            Up to 10 PDFs, 25 MB each. Processing runs asynchronously; the
            source stays private.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </ActionForm>
  );
}
export function SubjectForm() {
  return (
    <ActionForm action={createSubject} submit="Create subject">
      <FieldGroup>
        <TextField label="Subject name" name="name" required maxLength={100} />
        <LongField
          label="Description (optional)"
          name="description"
          maxLength={2000}
        />
      </FieldGroup>
    </ActionForm>
  );
}
