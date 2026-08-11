import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

export const reportSectionOptions = [
  {
    id: "executive-summary",
    label: "Executive Summary",
  },
  {
    id: "positioning",
    label: "Positioning",
  },
  {
    id: "audience",
    label: "Primary Audience",
  },
  {
    id: "essence-personality",
    label: "Essence & Personality",
  },
  {
    id: "voice",
    label: "Voice Direction",
  },
  {
    id: "visual",
    label: "Visual Direction",
  },
  {
    id: "guardrails",
    label: "Brand Guardrails",
  },
  {
    id: "considerations",
    label: "Strategic Considerations",
  },
  {
    id: "evidence",
    label: "Evidence & Decisions",
  },
] as const;

export type ReportSectionId =
  typeof reportSectionOptions[number]["id"];

export const defaultReportSectionIds =
  reportSectionOptions.map(
    (section) => section.id,
  );

export type StrategyReportStatus =
  | "draft"
  | "ready"
  | "issued";

export type StrategyReportConfiguration = {
  reportTitle: string;
  reportSubtitle: string;
  preparedFor: string;
  preparedBy: string;
  coverStatement: string;
  includedSections: ReportSectionId[];
};

export type StrategyReportRecord = {
  id: string;
  project_id: string;
  report_number: number;
  status: StrategyReportStatus;

  source_strategy_version_id: string;
  source_strategy_version_number: number;

  strategy_snapshot: AIStrategyOutput;

  configuration:
    StrategyReportConfiguration;

  issued_at:
    | string
    | null;

  created_at: string;
  updated_at: string;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function cleanText(
  value: unknown,
  fallback: string,
  maximum: number,
) {
  if (
    typeof value !== "string"
  ) {
    return fallback;
  }

  return value
    .trim()
    .slice(
      0,
      maximum,
    );
}

export function defaultReportConfiguration(
  brandName: string,
): StrategyReportConfiguration {
  return {
    reportTitle:
      "Brand Strategy",

    reportSubtitle:
      "A studio-approved strategic foundation for how the brand positions, communicates, expresses, and protects its identity.",

    preparedFor:
      brandName,

    preparedBy:
      "ELLIPSIS",

    coverStatement:
      "Clarity before expression. Strategy before execution.",

    includedSections:
      [...defaultReportSectionIds],
  };
}

export function normalizeReportConfiguration(
  value: unknown,
  brandName: string,
): StrategyReportConfiguration {
  const defaults =
    defaultReportConfiguration(
      brandName,
    );

  if (!isRecord(value)) {
    return defaults;
  }

  const validIds =
    new Set<string>(
      defaultReportSectionIds,
    );

  const includedSections =
    Array.isArray(
      value.includedSections,
    )
      ? value.includedSections
          .filter(
            (
              item,
            ): item is string =>
              typeof item ===
                "string" &&
              validIds.has(item),
          )
          .filter(
            (
              item,
              index,
              list,
            ) =>
              list.indexOf(item) ===
              index,
          ) as ReportSectionId[]
      : defaults.includedSections;

  return {
    reportTitle:
      cleanText(
        value.reportTitle,
        defaults.reportTitle,
        120,
      ),

    reportSubtitle:
      cleanText(
        value.reportSubtitle,
        defaults.reportSubtitle,
        500,
      ),

    preparedFor:
      cleanText(
        value.preparedFor,
        defaults.preparedFor,
        160,
      ),

    preparedBy:
      cleanText(
        value.preparedBy,
        defaults.preparedBy,
        160,
      ),

    coverStatement:
      cleanText(
        value.coverStatement,
        defaults.coverStatement,
        500,
      ),

    includedSections:
      includedSections.length > 0
        ? includedSections
        : defaults.includedSections,
  };
}

export function reportConfigurationSize(
  configuration:
    StrategyReportConfiguration,
) {
  return JSON.stringify(
    configuration,
  ).length;
}