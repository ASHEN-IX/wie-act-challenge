import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: { default: "Noveris", template: "%s · Noveris" },
  description:
    "The space for curious university minds. Study with your peers, get AI guidance, and turn every course into a shared breakthrough.",
};

// Dark is applied server-side so it is painted on the first frame; the only
// thing that can change it is a stored "light" preference, which ThemeControl
// reads on mount. That keeps us clear of the nonce CSP in src/proxy.ts, which
// blocks both inline and host-allowlisted scripts.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:z-50"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
