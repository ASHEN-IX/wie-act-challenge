/** Browser-safe public decoders only. These validate shape, never access grants. */
import {
  parseContract,
  parseRecipient,
  type Contract,
} from "@noveris/shared/ednova/contracts";
export type ActivityDefinition = Contract<"ActivityDefinition">;
export function decodeActivityDefinition(value: unknown): ActivityDefinition {
  return parseContract("ActivityDefinition", value);
}
export function decodeRoomActivityState(
  value: unknown,
): Contract<"RoomActivityState"> {
  return parseContract("RoomActivityState", value);
}
/** Private result boundary only; the caller must supply the authenticated user. */
export function decodePrivateAssessmentResult(
  value: unknown,
  authenticatedUserId: string,
): Contract<"AssessmentResult"> {
  return parseRecipient("AssessmentResult", value, authenticatedUserId);
}
