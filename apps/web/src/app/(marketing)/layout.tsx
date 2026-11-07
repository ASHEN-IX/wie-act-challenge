import "@/components/marketing/marketing.css";
import { SiteNav } from "@/components/landing/SiteNav";
import { Footer } from "@/components/landing/Footer";
import { ScrollExperience } from "@/components/marketing/scroll-experience";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-root">
      <ScrollExperience>
        <SiteNav />
        {children}
        <Footer />
      </ScrollExperience>
    </div>
  );
}
