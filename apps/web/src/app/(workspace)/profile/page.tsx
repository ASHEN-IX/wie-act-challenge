import { load } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import { updateProfile } from "@/features/account/actions";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { TextField, LongField } from "@/components/shared/form-field";
import { FieldGroup } from "@/components/ui/field";
import { acceptInstitutionInvitation } from "@/features/institutions/actions";
import { getInstitutionContexts } from "@/features/institutions/queries";
export const metadata = { title: "Settings" };
const roleLabels = {
  university_admin: "University administrator",
  instructor: "Instructor",
  university_student: "University student",
} as const;
export default async function Profile() {
  const [result, institutions, identity] = await Promise.all([
    load<{ profile: { nickname?: string; bio?: string } }>(
      "/api/v1/users/profile",
    ),
    getInstitutionContexts(),
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
      <section className="mt-12 max-w-xl border-t pt-8">
        <h2 className="text-lg font-semibold">Institutional contexts</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Memberships shown here are display context only. They do not grant
          access to another person&apos;s course or to unpublished course
          content.
        </p>
        <DataError message={institutions.error} />
        <ul className="mt-5 flex flex-col gap-3">
          {(institutions.data?.institutions || []).map((context) => (
            <li
              key={context.membership.id}
              className="rounded-md border px-4 py-3"
            >
              <p className="font-medium">{context.institution.name}</p>
              <p className="text-sm text-muted-foreground">
                {roleLabels[context.membership.role]} ·{" "}
                {context.institution.isVerified
                  ? "Verified institution"
                  : "Synthetic / unverified institution"}
              </p>
            </li>
          ))}
        </ul>
        {!institutions.error &&
          !(institutions.data?.institutions || []).length && (
            <p className="mt-5 text-sm text-muted-foreground">
              You are using a personal workspace with no active institutional
              membership.
            </p>
          )}
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium">
            Have an institution invitation?
          </summary>
          <div className="mt-4">
            <ActionForm
              action={acceptInstitutionInvitation}
              submit="Accept invitation"
              variant="outline"
            >
              <TextField
                label="Invitation token"
                name="token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                required
                maxLength={200}
                description="The token is single-use and is checked by the API, not by this form."
              />
            </ActionForm>
          </div>
        </details>
      </section>
    </>
  );
}
