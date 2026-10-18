import Screen from "@/screens/Profile";
import { requireIdentity } from "@/server/identity";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireIdentity("user");
  return <Screen />;
}
