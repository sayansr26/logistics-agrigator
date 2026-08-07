"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS } from "../content";

export function FaqSection() {
  return (
    <div className="w-full max-w-[880px]">
      <div className="text-center">
        <span className="eyebrow eyebrow-plain">QUESTIONS</span>
        <h2 className="mb-6 mt-4 text-[clamp(27px,min(3.6vw,5.6vh),48px)] font-bold leading-[1.05] tracking-[-0.035em]">
          Frequently asked
        </h2>
      </div>
      <Accordion
        type="single"
        collapsible
        defaultValue="faq-0"
        className="flex flex-col gap-2.5"
      >
        {FAQS.map((item, i) => (
          <AccordionItem
            key={item.q}
            value={`faq-${i}`}
            className="card overflow-hidden rounded-[18px] border-white/[.12] px-[22px] data-[state=open]:bg-white/[.12]"
          >
            <AccordionTrigger className="py-[18px] text-left text-[15.5px] font-semibold text-white hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="max-w-[660px] pb-5 text-sm leading-relaxed text-white/[.62]">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
