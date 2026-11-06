export type ActionResult<T> = { data: T } | { error: string; status: number };
export class NardouchActionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function unwrapAction<T>(result: ActionResult<T>): T {
  if ("error" in result)
    throw new NardouchActionError(result.status, result.error);
  return result.data;
}
