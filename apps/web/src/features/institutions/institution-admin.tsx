"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createInstitution,
  inviteInstitution,
  assignCourseMember,
} from "./admin-actions";
import type { InstitutionContext } from "./types";
export function InstitutionAdmin({
  contexts,
  platformAdmin,
}: {
  contexts: InstitutionContext[];
  platformAdmin: boolean;
}) {
  const [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [created, setCreated] = useState("");
  const [institutionId, setInstitution] = useState(
      contexts[0]?.institution.id || "",
    ),
    [role, setRole] = useState<"instructor" | "university_student">(
      "instructor",
    ),
    [token, setToken] = useState("");
  const [courseId, setCourse] = useState(""),
    [userId, setUser] = useState(""),
    [courseRole, setCourseRole] = useState<"instructor" | "student">("student");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Institution operation unavailable",
      );
    } finally {
      setBusy(false);
    }
  }
  // Learners hold no authority to invite or enroll, so they are not shown those forms.
  const activeRoles = contexts
    .filter((c) => c.membership.status === "active")
    .map((c) => c.membership.role as string);
  const canInvite = platformAdmin || activeRoles.includes("university_admin");
  const canAssign = canInvite || activeRoles.includes("instructor");
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Institutions and course access</h1>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      <ul>
        {contexts.map((c) => (
          <li key={c.institution.id}>
            {c.institution.name} — {c.membership.role} ({c.membership.status}){" "}
            <code>{c.institution.id}</code>
          </li>
        ))}
      </ul>
      {platformAdmin && (
        <section className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Create institution</h2>
          <label className="block">
            Institution name
            <input
              className="block border p-2"
              aria-label="Institution name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            Institution slug
            <input
              className="block border p-2"
              aria-label="Institution slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <Button
            disabled={busy || !name || !slug}
            onClick={() =>
              run(async () => {
                const r = await createInstitution({ name, slug });
                setInstitution(r.institution.id);
                setCreated(r.institution.id);
                setMessage(
                  "Institution created. Reload to view current membership.",
                );
              })
            }
          >
            Create institution
          </Button>
          <p>{created}</p>
        </section>
      )}
      {canInvite && (
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">Invite institution member</h2>
        <p>
          Current institution administrator authority is required. Share the
          invitation through your approved channel; recipients accept in
          Profile.
        </p>
        <label className="block">
          Institution ID
          <input
            className="block border p-2"
            aria-label="Invitation institution ID"
            value={institutionId}
            onChange={(e) => {
              setInstitution(e.target.value);
              setToken("");
            }}
          />
        </label>
        <label>
          Membership role
          <select
            aria-label="Membership role"
            className="border p-2"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="instructor">Instructor</option>
            <option value="university_student">Learner</option>
          </select>
        </label>
        <Button
          disabled={busy || !institutionId}
          onClick={() =>
            run(async () => {
              setToken((await inviteInstitution(institutionId, role)).token);
              setMessage(
                "Invitation issued. Acceptance establishes current membership.",
              );
            })
          }
        >
          Issue membership invitation
        </Button>
        {token && (
          <p className="break-all" data-testid="membership-invitation">
            {token}
          </p>
        )}
      </section>
      )}
      {canAssign && (
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">Assign instructor or enroll learner</h2>
        <p>
          Membership alone does not grant course access. The API checks the
          selected course and current institution roles.
        </p>
        <label className="block">
          Course ID
          <input
            className="block border p-2"
            aria-label="Assignment course ID"
            value={courseId}
            onChange={(e) => setCourse(e.target.value)}
          />
        </label>
        <label className="block">
          User ID
          <input
            className="block border p-2"
            aria-label="Assignment user ID"
            value={userId}
            onChange={(e) => setUser(e.target.value)}
          />
        </label>
        <label>
          Course role
          <select
            aria-label="Course role"
            className="border p-2"
            value={courseRole}
            onChange={(e) => setCourseRole(e.target.value as typeof courseRole)}
          >
            <option value="student">Learner enrollment</option>
            <option value="instructor">Assigned instructor</option>
          </select>
        </label>
        <Button
          disabled={busy || !courseId || !userId}
          onClick={() =>
            run(async () => {
              await assignCourseMember(courseId, userId, courseRole);
              setMessage("Course access assignment acknowledged.");
            })
          }
        >
          Apply course assignment
        </Button>
      </section>
      )}
      {!canAssign && (
        <p className="text-sm text-muted-foreground">
          Your institution roles are listed above. Institution administrators
          and instructors manage invitations and course enrollment. If you were
          sent an invitation, accept it in Settings.
        </p>
      )}
    </div>
  );
}
