import Image from "next/image";
import { stages, type StageId } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The in-workspace Nardouch. Deliberately small and contextual — the brand
 * guide reserves the expressive mascot for marketing, so this never sits
 * behind content or scales up.
 */
export function NardouchAvatar({
  stage = "learner",
  size = 32,
  className,
}: {
  stage?: StageId;
  size?: number;
  className?: string;
}) {
  const meta = stages.find((s) => s.id === stage) ?? stages[1];
  return (
    <Image
      src={`/images/nardouch-${meta.id}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      title={`Nardouch · ${meta.name}`}
    />
  );
}

/** Reward level drives the stage; XP is motivation, not mastery (see rewards). */
export function stageForLevel(level: number): StageId {
  if (level >= 20) return "graduate";
  if (level >= 12) return "expert";
  if (level >= 6) return "explorer";
  if (level >= 2) return "learner";
  return "baby";
}
