import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

import type {
  ReportSectionId,
} from "@/lib/report-production";

export type StrategyReportGroup = {
  label: string;
  items: string[];
};

export type StrategyReportSection = {
  id: ReportSectionId;
  number: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  groups: StrategyReportGroup[];
};

function cleanItems(
  items: string[],
) {
  return items
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);
}

export function buildStrategyReportSections(
  strategy: AIStrategyOutput,
  includedSections?: ReportSectionId[],
): StrategyReportSection[] {
  const sections:
    StrategyReportSection[] =
      [
        {
          id:
            "executive-summary",

          number:
            "01",

          eyebrow:
            "Strategic Overview",

          title:
            "Executive Summary",

          paragraphs: [
            strategy.executiveSummary,
          ],

          groups: [],
        },

        {
          id:
            "positioning",

          number:
            "02",

          eyebrow:
            "Market Direction",

          title:
            "Positioning",

          paragraphs: [
            strategy.positioning,
          ],

          groups: [
            {
              label:
                "Brand Promise",

              items:
                cleanItems([
                  strategy.brandPromise,
                ]),
            },
          ],
        },

        {
          id:
            "audience",

          number:
            "03",

          eyebrow:
            "Who We Serve",

          title:
            "Primary Audience",

          paragraphs: [
            strategy.audience,
          ],

          groups: [],
        },

        {
          id:
            "essence-personality",

          number:
            "04",

          eyebrow:
            "Brand Foundation",

          title:
            "Essence & Personality",

          paragraphs: [
            strategy.brandEssence,
            strategy.personality.summary,
          ],

          groups: [
            {
              label:
                "Personality Traits",

              items:
                cleanItems(
                  strategy
                    .personality
                    .traits,
                ),
            },
          ],
        },

        {
          id:
            "voice",

          number:
            "05",

          eyebrow:
            "Verbal Identity",

          title:
            "Voice Direction",

          paragraphs: [
            strategy
              .voiceDirection
              .summary,
          ],

          groups: [
            {
              label:
                "Voice Principles",

              items:
                cleanItems(
                  strategy
                    .voiceDirection
                    .principles,
                ),
            },

            {
              label:
                "Avoid",

              items:
                cleanItems(
                  strategy
                    .voiceDirection
                    .avoid,
                ),
            },
          ],
        },

        {
          id:
            "visual",

          number:
            "06",

          eyebrow:
            "Creative Identity",

          title:
            "Visual Direction",

          paragraphs: [
            strategy
              .visualDirection
              .summary,
          ],

          groups: [
            {
              label:
                "Visual Principles",

              items:
                cleanItems(
                  strategy
                    .visualDirection
                    .principles,
                ),
            },

            {
              label:
                "Avoid",

              items:
                cleanItems(
                  strategy
                    .visualDirection
                    .avoid,
                ),
            },
          ],
        },

        {
          id:
            "guardrails",

          number:
            "07",

          eyebrow:
            "Creative Discipline",

          title:
            "Brand Guardrails",

          paragraphs: [],

          groups: [
            {
              label:
                "Creative Guardrails",

              items:
                cleanItems(
                  strategy
                    .creativeGuardrails,
                ),
            },
          ],
        },

        {
          id:
            "considerations",

          number:
            "08",

          eyebrow:
            "Strategic Awareness",

          title:
            "Strategic Considerations",

          paragraphs: [],

          groups: [
            {
              label:
                "Risks & Considerations",

              items:
                cleanItems(
                  strategy
                    .strategicRisks,
                ),
            },
          ],
        },

        {
          id:
            "evidence",

          number:
            "09",

          eyebrow:
            "Evidence",

          title:
            "Evidence & Decisions",

          paragraphs: [
            "These considerations preserve the boundaries of what the approved discovery evidence currently supports.",
          ],

          groups: [
            {
              label:
                "Evidence Caveats",

              items:
                cleanItems(
                  strategy
                    .evidenceCaveats,
                ),
            },
          ],
        },
      ];

  if (
    !includedSections ||
    includedSections.length ===
      0
  ) {
    return sections;
  }

  const allowed =
    new Set(
      includedSections,
    );

  return sections.filter(
    (section) =>
      allowed.has(
        section.id,
      ),
  );
}