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
        title="Show your thinking"
        description="Work through a question and get private feedback on your explanation."
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
              maxLength={2000}
              rows={3}
            />
            <LongField
              label="Your explanation"
              name="answer"
              required
              maxLength={4000}
              rows={7}
              placeholder="Explain how you arrived at your answer…"
            />
          </FieldGroup>
        </JobForm>
        <p className="mt-8 text-xs leading-6 text-muted-foreground">
          Feedback depends on the evaluation worker and your account’s access.
          AI feedback can be mistaken; check it against your course sources.
        </p>
      </div>
    </>
  );
}
