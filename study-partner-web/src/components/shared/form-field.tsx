import type { ComponentProps } from "react";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export function TextField({
  label,
  description,
  ...props
}: ComponentProps<typeof Input> & { label: string; description?: string }) {
  const id = props.id || props.name;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input {...props} id={id} />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}
export function LongField({
  label,
  ...props
}: ComponentProps<typeof Textarea> & { label: string }) {
  const id = props.id || props.name;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea {...props} id={id} />
    </Field>
  );
}
