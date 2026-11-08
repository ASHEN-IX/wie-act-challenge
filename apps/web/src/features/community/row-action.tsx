"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormAction } from "@/lib/action-state";

/** A small one-button form for list rows: hidden fields, inline result, no layout shift. */
export function RowAction({
  action,
  fields,
  label,
  pendingLabel = "Please wait…",
  variant = "outline",
  confirm,
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  /** Ask the browser to confirm before submitting (destructive actions). */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className="flex items-center gap-2"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error && (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      )}
      {state.success && (
        <span role="status" className="text-xs text-muted-foreground">
          {state.success}
        </span>
      )}
    </form>
  );
}
