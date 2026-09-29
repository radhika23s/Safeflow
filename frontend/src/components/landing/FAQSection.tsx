import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Reveal, SectionHeading } from "./shared";

const faqs = [
  {
    question: "What is Safe Flow?",
    answer:
      "Safe Flow is a financial-crime intelligence platform designed to help investigators connect alerts, transaction relationships, evidence, risk analysis and regulatory context in one workflow.",
  },
  {
    question: "Who is Safe Flow designed for?",
    answer:
      "It is designed for financial-crime analysts, compliance teams, risk operations and investigation teams that need a structured way to review suspicious activity and explain decisions.",
  },
  {
    question: "How does the Digital Investigator work?",
    answer:
      "The Digital Investigator brings together data collection, risk analysis, graph relationships and regulatory grounding, then presents findings in a structured case view for human review.",
  },
  {
    question: "Does the AI make the final financial decision?",
    answer:
      "No. The platform supports investigation teams with evidence, scoring and recommendations, while the final decision remains under human control.",
  },
  {
    question: "How does Safe Flow explain a risk score?",
    answer:
      "The platform decomposes the score into contributing factors such as transaction pattern, graph context, device or IP signals, location and account profile so analysts can inspect the reasoning behind the score.",
  },
  {
    question: "How does regulatory RAG work?",
    answer:
      "Regulatory RAG retrieves relevant sources and context from a regulatory knowledge base before presenting findings to the investigator, helping ground the analysis in structured reference material.",
  },
  {
    question: "What types of reports can be generated?",
    answer:
      "The prototype presents investigation-ready reporting views, including case summaries and report sections such as executive findings, evidence and recommended actions. The interface demonstrates PDF and STR draft generation flows.",
  },
  {
    question: "Can Safe Flow integrate with banking systems?",
    answer:
      "The current prototype is designed as an investigation experience and signals the architecture for future system integration, but no specific banking integration implementation is claimed here.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-background py-20 md:py-28">
      <div className="container-hz">
        <Reveal>
          <SectionHeading
            eyebrow="FAQ"
            title="Questions, answered."
            description="A quick overview of how the Safe Flow workflow, risk intelligence and regulatory grounding are designed to work together."
          />
        </Reveal>

        <Reveal delay={120} className="mt-12">
          <div className="mx-auto max-w-4xl rounded-[28px] border border-border bg-card shadow-[var(--shadow-card)]">
            {faqs.map((item, index) => {
              const isOpen = openIndex === index;

              return (
                <div
                  key={item.question}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    index === 0 && "rounded-t-[28px]",
                    index === faqs.length - 1 && "rounded-b-[28px]",
                  )}
                >
                  <h3>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:px-6"
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${index}`}
                      id={`faq-trigger-${index}`}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                    >
                      <span>{item.question}</span>
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background transition-transform duration-200",
                          isOpen && "rotate-180",
                        )}
                        aria-hidden
                      >
                        <ChevronDown className="size-4" />
                      </span>
                    </button>
                  </h3>

                  <div
                    id={`faq-panel-${index}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${index}`}
                    className={cn(
                      "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground md:px-6">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
