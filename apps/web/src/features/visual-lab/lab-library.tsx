import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ENGINE_LABEL, type LabSummary } from "./queries";

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/** The learner's saved labs. Opening one never regenerates it. */
export function LabLibrary({
  labs,
  courseTitles,
}: {
  labs: LabSummary[];
  courseTitles: Record<string, string>;
}) {
  if (!labs.length)
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Labs you create appear here, so you can reopen them without generating
        them again.
      </p>
    );
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {labs.map((lab) => (
        <li key={lab.labId}>
          <Link
            href={`/visual-lab/${lab.labId}`}
            className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
          >
            <span className="text-sm font-medium">{lab.concept}</span>
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{ENGINE_LABEL[lab.engine]}</Badge>
              <span>
                {lab.courseId
                  ? (courseTitles[lab.courseId] ?? "Course")
                  : "Open topic"}
              </span>
              <span aria-hidden>·</span>
              <time dateTime={lab.createdAt}>
                {date.format(new Date(lab.createdAt))}
              </time>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
