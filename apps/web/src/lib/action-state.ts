export interface ActionState {
  error?: string;
  success?: string;
  destination?: string;
  destinationLabel?: string;
  jobId?: string;
  correlationId?: string;
}
export type FormAction = (
  state: ActionState,
  form: FormData,
) => Promise<ActionState>;
