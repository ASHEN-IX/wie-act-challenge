import Screen from "@/screens/BackgroundCustomizer";
import { requireIdentity } from "@/server/identity";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireIdentity("student");
  return <Screen />;
}
