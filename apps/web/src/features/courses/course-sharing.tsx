"use client";
import { useActionState, useState } from "react";
import { issueCourseInvitationAction } from "./actions";
import { SubmitButton } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";

export function CourseSharing({ courseId }: { courseId: string }) {
  const [state, action] = useActionState(issueCourseInvitationAction, {});
  const [copyMessage, setCopyMessage] = useState("");
  return (
    <form action={action} onSubmit={() => setCopyMessage("")} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <p className="text-sm text-muted-foreground">Create one invitation per student. The code expires after 7 days and can be used by one student who already belongs to your institution.</p>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.invitation && (
        <div className="space-y-3 rounded-lg border p-4">
          <p role="status" className="text-sm">{state.success}</p>
          <label htmlFor="student-invitation-code" className="block text-sm font-medium">Student invitation code</label>
            <textarea id="student-invitation-code" readOnly value={state.invitation.token} className="mt-2 w-full resize-none rounded-md border bg-background p-3 text-sm" rows={3} onFocus={(event) => event.target.select()} />
          <Button type="button" variant="outline" onClick={async () => {
            try {
              await navigator.clipboard.writeText(state.invitation!.token);
              setCopyMessage("Code copied. Send it to one student.");
            } catch { setCopyMessage("Select the code above and copy it manually."); }
          }}>Copy invitation code</Button>
          {copyMessage && <p role="status" className="text-sm">{copyMessage}</p>}
          <p className="text-xs text-muted-foreground">Copy this code before leaving the page. Create a new invitation if you lose it.</p>
          <p className="text-sm text-muted-foreground">Tell the student: Sign in → My Learning → Join your teacher’s course → paste this code.</p>
        </div>
      )}
      <SubmitButton>{state.invitation ? "Create another student invitation" : "Create student invitation"}</SubmitButton>
    </form>
  );
}
