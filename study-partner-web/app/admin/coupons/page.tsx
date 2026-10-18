import Screen from "@/screens/AdminCoupons";
import { requireIdentity } from "@/server/identity";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireIdentity("admin");
  return <Screen />;
}
