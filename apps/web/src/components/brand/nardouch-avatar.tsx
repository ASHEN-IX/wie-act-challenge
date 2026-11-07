import Image from "next/image";
import { nardouchImage, stages, type StageId } from "@/lib/brand";
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
      src={nardouchImage(meta.id)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      title={`Nardouch · ${meta.name}`}
    />
  );
}
