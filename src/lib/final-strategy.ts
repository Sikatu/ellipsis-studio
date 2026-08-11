import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

export type FinalStrategyStatus =
  | "draft"
  | "approved";

export type FinalStrategyVersion = {
  id: string;
  project_id: string;
  version_number: number;
  status: FinalStrategyStatus;

  source_ai_run_id:
    | string
    | null;

  source_fingerprint: string;
  source_model: string;
  prompt_version: string;

  strategy: AIStrategyOutput;

  editorial_notes: string;

  approved_at:
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

function isStringArray(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string",
    )
  );
}

export function isAIStrategyOutput(
  value: unknown,
): value is AIStrategyOutput {
  if (!isRecord(value)) {
    return false;
  }

  const personality =
    value.personality;

  const visualDirection =
    value.visualDirection;

  const voiceDirection =
    value.voiceDirection;

  if (
    !isRecord(personality) ||
    !isRecord(visualDirection) ||
    !isRecord(voiceDirection)
  ) {
    return false;
  }

  return (
    typeof value.executiveSummary ===
      "string" &&

    typeof value.positioning ===
      "string" &&

    typeof value.audience ===
      "string" &&

    typeof value.brandPromise ===
      "string" &&

    typeof value.brandEssence ===
      "string" &&

    typeof personality.summary ===
      "string" &&

    isStringArray(
      personality.traits,
    ) &&

    typeof visualDirection.summary ===
      "string" &&

    isStringArray(
      visualDirection.principles,
    ) &&

    isStringArray(
      visualDirection.avoid,
    ) &&

    typeof voiceDirection.summary ===
      "string" &&

    isStringArray(
      voiceDirection.principles,
    ) &&

    isStringArray(
      voiceDirection.avoid,
    ) &&

    isStringArray(
      value.creativeGuardrails,
    ) &&

    isStringArray(
      value.strategicRisks,
    ) &&

    isStringArray(
      value.evidenceCaveats,
    )
  );
}

export function strategyPayloadSize(
  strategy: AIStrategyOutput,
) {
  return JSON.stringify(
    strategy,
  ).length;
}