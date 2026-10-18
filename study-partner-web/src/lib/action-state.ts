export interface ActionState {
  error?: string;
  success?: string;
  jobId?: string;
  correlationId?: string;
}
export type FormAction = (
  state: ActionState,
  form: FormData,
) => Promise<ActionState>;
