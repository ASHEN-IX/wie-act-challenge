'use client';
import React from "react";
import HeroSection from "../components/landing/HeroSection";
import FeaturesSection from "../components/landing/FeaturesSection";
import HowItWorks from "../components/landing/HowItWorks";
import AgentsSection from "../components/landing/AgentsSection";
import CTASection from "../components/landing/CTASection";

const Landing = () => {
  return (
    <div className="relative min-h-screen bg-transparent text-foreground transition-colors duration-300">
      <div className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <HowItWorks />
        <AgentsSection />
        <CTASection />
      </div>
    </div>
  );
};

export default Landing;
