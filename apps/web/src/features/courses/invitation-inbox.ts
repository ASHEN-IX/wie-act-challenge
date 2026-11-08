import "server-only";
import { load } from "@/lib/api";

export interface InvitationInbox {
  pendingCount: number;
  invitations: { id: string; title: string; expiresAt: string }[];
}

export function getInvitationInbox() {
  return load<InvitationInbox>("/api/v1/study/courses/invitations/inbox");
}
