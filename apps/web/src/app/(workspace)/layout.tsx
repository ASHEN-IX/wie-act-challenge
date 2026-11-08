import { requireIdentity } from "@/server/identity";
import { hasTeachingAccess } from "@/server/teaching";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { load } from "@/lib/api";
import {
  normalizeLearningProfile,
  suggestFocusMinutes,
  type LearningProfile,
} from "@ednova/shared/ednova/learningProfile";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireIdentity();
  const admin = identity.role === "admin";
  const instructor = await hasTeachingAccess();
  const learning = await load<{ learningProfile: LearningProfile }>(
    "/api/v1/users/profile/learning",
  );
  const focusMinutes = suggestFocusMinutes(
    learning.data ? normalizeLearningProfile(learning.data.learningProfile) : null,
  );
  return (
    <WorkspaceShell
      focusMinutes={focusMinutes}
      email={identity.email}
      admin={admin}
      instructor={instructor}
    >
      {children}
    </WorkspaceShell>
  );
}
