import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  small = false,
  className,
}: {
  href?: string;
  small?: boolean;
  className?: string;
}) {
  const size = small ? 34 : 40;
  return (
    <Link
      href={href}
      aria-label="Noveris home"
      className={cn(
        "inline-flex items-center gap-2.5 whitespace-nowrap font-heading font-extrabold tracking-tight",
        small ? "text-xl" : "text-2xl",
        className,
      )}
    >
      <Image
        src="/brand/noveris-symbol.svg"
        alt=""
        width={size}
        height={size}
        priority={!small}
        className="drop-shadow-[0_4px_12px_rgba(154,89,255,0.32)]"
      />
      <span>Noveris</span>
    </Link>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/brand/noveris-symbol.svg"
      alt=""
      width={size}
      height={size}
      className="rounded-lg"
    />
  );
}
