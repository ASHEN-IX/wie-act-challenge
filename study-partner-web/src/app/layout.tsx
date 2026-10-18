import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EdNova", template: "%s · EdNova" },
  description: "Your space to learn, practice and study together.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
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
