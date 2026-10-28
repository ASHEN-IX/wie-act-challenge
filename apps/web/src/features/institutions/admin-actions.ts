"use server";
import { api, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
export async function createInstitution(input: { name: string; slug: string }) {
  await requireIdentity("admin");
  return api<{ institution: { id: string; name: string } }>(
    "/api/v1/study/institutions/bootstrap",
    { method: "POST", body: JSON.stringify(input) },
  );
}
export async function inviteInstitution(
  institutionId: string,
  role: "instructor" | "university_student",
) {
  await requireIdentity();
  return api<{ token: string }>(
    `/api/v1/study/institutions/${segment(institutionId)}/invitations`,
    { method: "POST", body: JSON.stringify({ role }) },
  );
}
export async function assignCourseMember(
  courseId: string,
  userId: string,
  role: "instructor" | "student",
) {
  await requireIdentity();
  return api(
    `/api/v1/study/courses/${segment(courseId)}/${role === "instructor" ? "instructors" : "enrollments"}`,
    {
      method: "POST",
      body: JSON.stringify(
        role === "instructor"
          ? { instructorUserId: userId }
          : { studentUserId: userId },
      ),
    },
  );
}
