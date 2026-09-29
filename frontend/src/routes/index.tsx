import { createFileRoute } from "@tanstack/react-router";
import { AgentArchitecture } from "@/components/landing/AgentArchitecture";
import { ComplianceSection } from "@/components/landing/ComplianceSection";
import { ExplainabilitySection } from "@/components/landing/ExplainabilitySection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { HumanDecisionSection } from "@/components/landing/HumanDecisionSection";
import { InvestigationFlow } from "@/components/landing/InvestigationFlow";
import { InvestigatorSection } from "@/components/landing/InvestigatorSection";
import { Navbar } from "@/components/landing/Navbar";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { ReportSection } from "@/components/landing/ReportSection";
import { RiskIntelligence } from "@/components/landing/RiskIntelligence";
import { TrustBar } from "@/components/landing/TrustBar";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="gov-dashboard min-h-screen bg-background text-foreground">
      <Navbar />

      <main>
        <HeroSection />
        <TrustBar />
        <ProblemSection />
        <InvestigatorSection />
        <AgentArchitecture />
        <RiskIntelligence />
        <ExplainabilitySection />
        <ComplianceSection />
        <InvestigationFlow />
        <ReportSection />
        <HumanDecisionSection />
        <FAQSection />
        <FinalCTA />
      </main>

      <div id="about">
        <Footer />
      </div>
    </div>
  );
}
