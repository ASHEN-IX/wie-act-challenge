export interface ActionState {
  error?: string;
  invitation?: { token: string; expiresAt: string };
  publishedRevisionTag?: string;
  success?: string;
  createdSubject?: { id: string; name: string };
  destination?: string;
  destinationLabel?: string;
  selectedSubjectId?: string;
  jobId?: string;
  correlationId?: string;
}
export type FormAction = (
  state: ActionState,
  form: FormData,
) => Promise<ActionState>;
