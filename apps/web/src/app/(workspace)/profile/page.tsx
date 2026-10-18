import { load } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import { updateProfile } from "@/features/account/actions";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { TextField, LongField } from "@/components/shared/form-field";
import { FieldGroup } from "@/components/ui/field";
export const metadata = { title: "Settings" };
export default async function Profile() {
  const [result, identity] = await Promise.all([
    load<{ profile: { nickname?: string; bio?: string } }>(
      "/api/v1/users/profile",
    ),
    requireIdentity(),
  ]);
  return (
    <>
      <PageHeader
        title="Your settings"
        description="A few details to make this space yours."
      />
      <DataError message={result.error} />
      <div className="max-w-xl">
        <p className="mb-8 text-sm text-muted-foreground">
          Signed in as {identity.email}
        </p>
        <ActionForm action={updateProfile} submit="Save changes">
          <FieldGroup>
            <TextField
              label="Display name"
              name="nickname"
              defaultValue={
                result.data?.profile.nickname || identity.email.split("@")[0]
              }
              required
              maxLength={80}
            />
            <LongField
              label="Bio"
              name="bio"
              defaultValue={result.data?.profile.bio || ""}
              maxLength={500}
            />
          </FieldGroup>
        </ActionForm>
      </div>
    </>
  );
}
