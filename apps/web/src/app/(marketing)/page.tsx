import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { NardouchEvolution } from "@/components/landing/NardouchEvolution";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <HowItWorks />
      <NardouchEvolution />
      <FinalCTA />
    </main>
  );
}
