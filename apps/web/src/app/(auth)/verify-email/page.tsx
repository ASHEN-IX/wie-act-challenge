import { AuthForm } from "@/features/auth/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; verified?: string }>;
}) {
  const query = await searchParams;
  return (
    <AuthForm
      mode="verify"
      token={query.token}
      verified={query.verified === "true"}
    />
  );
}
