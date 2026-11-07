import type { AnchorHTMLAttributes, PropsWithChildren } from "react";
/** Router-free component fixture; actual Next links are checked on the landing page. */
export default function Link(
  props: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>,
) {
  return <a {...props} />;
}
