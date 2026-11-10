import { load } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { LearningPreferencesForm } from "@/features/onboarding/learning-preferences-form";
import { safeNext } from "@/features/onboarding/options";
import {
  defaultLearningProfile,
  normalizeLearningProfile,
  type LearningProfile,
} from "@noveris/shared/ednova/learningProfile";

export const metadata = { title: "Set up your learning" };

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const result = await load<{ learningProfile: LearningProfile }>(
    "/api/v1/users/profile/learning",
  );
  return (
    <>
      <PageHeader
        title="Set up your learning"
        description="A few quick questions so suggestions fit you. Everything is optional and you can change it any time in Settings."
      />
      <DataError message={result.error} />
      <LearningPreferencesForm
        mode="onboarding"
        next={safeNext(next)}
        initial={
          result.data
            ? normalizeLearningProfile(result.data.learningProfile)
            : defaultLearningProfile()
        }
      />
    </>
  );
}
