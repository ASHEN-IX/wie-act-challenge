import crypto from "node:crypto";
import { PageHeader } from "@/components/shared/page-header";
import { LongField } from "@/components/shared/form-field";
import { FieldGroup } from "@/components/ui/field";
import { JobForm } from "@/features/learning/job-form";
import { submitPractice } from "@/features/learning/actions";
export const metadata = { title: "Practice" };
export default function Practice() {
  return (
    <>
      <PageHeader
        title="Practice"
        description="Write a question and your explanation. You get private feedback you can check against your sources."
      />
      <div className="max-w-2xl">
        <JobForm action={submitPractice} kind="eval" submit="Get feedback">
          <FieldGroup>
            <input type="hidden" name="sessionId" value={crypto.randomUUID()} />
            <input type="hidden" name="step" value="1" />
            <LongField
              label="Question or problem"
              name="question"
              required
              maxLength={1000}
              rows={3}
            />
            <LongField
              label="Your explanation"
              name="answer"
              required
              maxLength={3500}
              rows={7}
              placeholder="Explain how you arrived at your answer…"
            />
          </FieldGroup>
        </JobForm>
        <p className="mt-8 text-xs leading-6 text-muted-foreground">
          AI feedback can be mistaken. Check it against your course sources.
        </p>
      </div>
    </>
  );
}
