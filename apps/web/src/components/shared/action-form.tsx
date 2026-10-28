"use client";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormAction } from "@/lib/action-state";

export function SubmitButton({
  children = "Save",
  variant = "default",
}: {
  children?: ReactNode;
  variant?: "default" | "outline" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending && (
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
      )}
      {pending ? "Please wait…" : children}
    </Button>
  );
}
export function ActionForm({
  action,
  children,
  submit = "Save",
  variant,
  className,
}: {
  action: FormAction;
  children?: ReactNode;
  submit?: string;
  variant?: "default" | "outline" | "destructive";
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className || "flex flex-col gap-5"}>
      {children}
      {state.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.success && (
        <Alert role="status">
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}
      {state.destination && (
        <Link className="underline" href={state.destination}>
          {state.destinationLabel || "Open course"}
        </Link>
      )}
      <div>
        <SubmitButton variant={variant}>{submit}</SubmitButton>
      </div>
    </form>
  );
}
