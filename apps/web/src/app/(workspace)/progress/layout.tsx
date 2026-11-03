import { redirect } from "next/navigation";
import { hasTeachingAccess } from "@/server/teaching";

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  if (await hasTeachingAccess()) redirect("/dashboard");
  return children;
}
