import Application from '../src/next-entry';
import { Suspense } from 'react';
import '../src/index.css';
import '../src/backgrounds.css';
export const metadata = { title: 'MindFlow', description: 'Your study partner' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a><Suspense><Application>{children}</Application></Suspense></body></html>;
}
