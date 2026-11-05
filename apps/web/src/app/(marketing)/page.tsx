import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { EvolutionTimeline } from "@/components/marketing/evolution-timeline";
import { JourneyBanner } from "@/components/marketing/journey-banner";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <EvolutionTimeline />
      <JourneyBanner />
    </main>
  );
}
