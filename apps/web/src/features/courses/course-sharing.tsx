"use client";
import { useActionState, useState } from "react";
import { issueCourseInvitationAction } from "./actions";
import { SubmitButton } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CourseSharing({ courseId }: { courseId: string }) {
  const [state, action] = useActionState(issueCourseInvitationAction, {});
  const [email, setEmail] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  return (
    <form action={action} onSubmit={() => setCopyMessage("")} className="space-y-4 rounded-lg border bg-card p-5">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="space-y-2">
        <label htmlFor="student-email" className="block text-sm font-medium">Student email</label>
        <Input id="student-email" name="email" type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="student@university.edu" aria-describedby="student-email-help" />
        <p id="student-email-help" className="text-sm text-muted-foreground">Enter an email to add the invitation to the student’s Notifications and send them a copy. Leave it blank to create a shareable code. Invitations expire after 7 days.</p>
      </div>
      <SubmitButton>{email.trim() ? "Send email invitation" : "Create invitation code"}</SubmitButton>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.invitation && (
        <div className="space-y-3 rounded-lg border p-4">
          <p role="status" className="text-sm">{state.success}</p>
          <label htmlFor="student-invitation-code" className="block text-sm font-medium">Student invitation code</label>
            <Input id="student-invitation-code" readOnly value={state.invitation.token} className="w-full font-mono tracking-wider" onFocus={(event) => event.target.select()} />
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
    </form>
  );
}
