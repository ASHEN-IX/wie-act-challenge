import "@/components/marketing/marketing.css";
import { SiteNav } from "@/components/marketing/site-nav";
import { Footer } from "@/components/marketing/footer";
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
