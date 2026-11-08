import { ActionForm } from "@/components/shared/action-form";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { acceptCourseInvitationAction } from "@/features/courses/actions";
import { getInvitationInbox } from "@/features/courses/invitation-inbox";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { data, error } = await getInvitationInbox();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" description="Accept course invitations from your instructors." />
      {error ? (
        <DataError message={error} />
      ) : data?.invitations.length ? (
        <ul className="divide-y rounded-lg border bg-card">
          {data.invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Course invitation</p>
                <h2 className="break-words font-semibold">{invitation.title}</h2>
              </div>
              <ActionForm action={acceptCourseInvitationAction} submit="Accept and open course">
                <input type="hidden" name="invitationId" value={invitation.id} />
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No pending invitations" description="Invitations sent to your account email will appear here." />
      )}
    </div>
  );
}
