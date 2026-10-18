import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { sessionId } = await searchParams;
  redirect(
    sessionId ? "/sessions/" + encodeURIComponent(sessionId) : "/sessions",
  );
}
