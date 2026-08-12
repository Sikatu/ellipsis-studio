import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  AI_STRATEGIST_PROMPT_VERSION,
  type AIStrategyOutput,
} from "@/lib/ai-strategy";

import {
  AIRouterExhaustedError,
  generateStrategyWithFailover,
  getAIProviderStatuses,
} from "@/lib/ai/router";

import {
  defaultAIPrivacyMode,
  normalizeAIPrivacyMode,
} from "@/lib/ai/provider-config";

import type {
  AIPrivacyMode,
  AIProviderAttempt,

} from "@/lib/ai/provider-types";

import {
  buildApprovedStrategyPackageFingerprint,
  evaluateStrategyApprovalGate,
  type StrategyReviewLike,
} from "@/lib/strategy-review";

import {
  buildBrandIntelligence,
} from "@/lib/discovery-intelligence";

import {
  buildStrategySynthesis,
} from "@/lib/strategy-synthesis";

import {
  createClient,
} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StrategyRunRecord = {
  id: string;
  status:
    | "completed"
    | "failed";
  provider: string;
  model: string;
  prompt_version: string;
  source_fingerprint: string;
  output:
    | AIStrategyOutput
    | null;
  error_message:
    | string
    | null;
  provider_request_id:
    | string
    | null;
  provider_attempts:
    | AIProviderAttempt[]
    | null;
  privacy_mode:
    AIPrivacyMode;
  latency_ms:
    | number
    | null;
  input_tokens:
    | number
    | null;
  output_tokens:
    | number
    | null;
  total_tokens:
    | number
    | null;
  created_at: string;
};

async function authenticatedAdmin() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
    };
  }

  const {
    data: profile,
  } = await supabase
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user: profile
      ? user
      : null,
  };
}

async function loadStrategyContext(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  projectId: string,
) {
  const {
    data: project,
    error: projectError,
  } = await supabase
    .from("discovery_projects")
    .select(
      "id,title,status,progress,submitted_at,created_by",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (
    projectError ||
    !project
  ) {
    return null;
  }

  const {
    data: responseRows,
    error: responseError,
  } = await supabase
    .from("discovery_responses")
    .select(
      "question_id,answer,updated_at",
    )
    .eq(
      "project_id",
      projectId,
    );

  if (responseError) {
    throw new Error(
      responseError.message,
    );
  }

  const {
    data: reviewRows,
    error: reviewError,
  } = await supabase
    .from("strategy_reviews")
    .select(
      "deliverable_id,status,notes,source_fingerprint",
    )
    .eq(
      "project_id",
      projectId,
    );

  if (reviewError) {
    throw new Error(
      reviewError.message,
    );
  }

  const intelligence =
    buildBrandIntelligence(
      responseRows ?? [],
    );

  const synthesis =
    buildStrategySynthesis(
      responseRows ?? [],
      intelligence,
    );

  const reviews =
    (reviewRows ??
      []) as StrategyReviewLike[];

  const gate =
    evaluateStrategyApprovalGate(
      synthesis,
      reviews,
    );

  const packageFingerprint =
    buildApprovedStrategyPackageFingerprint(
      synthesis,
      reviews,
    );

  return {
    project,
    responseRows:
      responseRows ?? [],
    reviews,
    intelligence,
    synthesis,
    gate,
    packageFingerprint,
  };
}

async function loadLatestRuns(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  projectId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from("strategy_ai_runs")
    .select(
      [
        "id",
        "status",
        "provider",
        "model",
        "prompt_version",
        "source_fingerprint",
        "output",
        "error_message",
        "provider_request_id",
        "provider_attempts",
        "privacy_mode",
        "latency_ms",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "created_at",
      ].join(","),
    )
    .eq(
      "project_id",
      projectId,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(5);

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return (
    data ??
    []
  ) as unknown as StrategyRunRecord[];
}

function strategyInput(
  context: NonNullable<
    Awaited<
      ReturnType<
        typeof loadStrategyContext
      >
    >
  >,
) {
  const reviewMap =
    new Map(
      context.reviews.map(
        (review) => [
          review.deliverable_id,
          review,
        ],
      ),
    );

  return {
    project: {
      title:
        context.project.title,
    },

    approvedStrategy:
      context.synthesis.deliverables.map(
        (item) => {
          const review =
            reviewMap.get(
              item.id,
            );

          return {
            id: item.id,
            category:
              item.category,
            label:
              item.label,
            statement:
              item.statement,
            guidance:
              item.guidance,
            evidenceScore:
              item.evidenceScore,

            evidence:
              item.evidence.map(
                (evidence) => ({
                  questionId:
                    evidence.questionId,

                  title:
                    evidence.title,

                  value:
                    evidence.value,

                  quality:
                    evidence.quality,
                }),
              ),

            studioNotes:
              review?.notes ??
              "",
          };
        },
      ),

    deterministicRisks:
      context.synthesis.risks.map(
        (risk) => ({
          severity:
            risk.severity,
          title:
            risk.title,
          detail:
            risk.detail,
        }),
      ),

    alignmentFlags:
      context.intelligence
        .alignmentFlags,
  };
}

const strategistInstructions = `
You are the ELLIPSIS Brand Strategy synthesis engine.

Your job is to transform studio-approved deterministic brand evidence into a polished working brand strategy.

NON-NEGOTIABLE RULES:

1. Use only the supplied evidence.
2. Do not invent demographics, locations, competitors, metrics, claims, product features, customer behaviors, proof points, brand history, color values, or market facts.
3. Do not infer a fact merely because it would be common for a business of this type.
4. Studio-approved strategy statements are authoritative working inputs.
5. Studio notes are authoritative editorial guidance.
6. Preserve meaningful ambiguity when the evidence does not support a stronger conclusion.
7. If something is not established, state that it is not yet established instead of inventing it.
8. Do not browse the web.
9. Do not cite external knowledge.
10. Write as a senior brand strategist: clear, precise, premium, concise, and actionable.
11. Keep strategic language distinct from marketing hype.
12. The output must strictly match the supplied JSON schema.

This is a synthesis task, not a research task.
`.trim();

function providerLabel(
  provider:
    string | null,
) {
  if (!provider) {
    return null;
  }

  const labels:
    Record<
      string,
      string
    > = {
      groq: "Groq",
      openrouter:
        "OpenRouter",
      ollama: "Ollama",
      gemini: "Gemini",
      openai: "OpenAI",
    };

  return (
    labels[provider] ??
    provider
  );
}

function failedRunValues({
  projectId,
  userId,
  sourceFingerprint,
  privacyMode,
  attempts,
  message,
  latencyMs,
}: {
  projectId: string;
  userId: string;
  sourceFingerprint: string;
  privacyMode: AIPrivacyMode;
  attempts: AIProviderAttempt[];
  message: string;
  latencyMs: number;
}) {
  const lastAttempt =
    attempts.length > 0
      ? attempts[
          attempts.length - 1
        ]
      : undefined;

  return {
    project_id:
      projectId,

    requested_by:
      userId,

    source_fingerprint:
      sourceFingerprint,

    provider:
      lastAttempt
        ?.provider ??
      "router",

    model:
      lastAttempt
        ?.requestedModel ??
      "automatic",

    prompt_version:
      AI_STRATEGIST_PROMPT_VERSION,

    status: "failed",

    output: null,

    error_message:
      message,

    provider_request_id:
      null,

    provider_attempts:
      attempts,

    privacy_mode:
      privacyMode,

    latency_ms:
      latencyMs,

    openai_response_id:
      null,
  };
}

export async function GET(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } = await authenticatedAdmin();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const projectId =
    request.nextUrl.searchParams.get(
      "projectId",
    );

  if (
    !projectId ||
    !uuidPattern.test(
      projectId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid project ID",
      },
      {
        status: 400,
      },
    );
  }

  const privacyParam =
    request.nextUrl.searchParams.get(
      "privacyMode",
    );

  const privacyMode =
    privacyParam
      ? normalizeAIPrivacyMode(
          privacyParam,
        )
      : defaultAIPrivacyMode();

  try {
    const context =
      await loadStrategyContext(
        supabase,
        projectId,
      );

    if (!context) {
      return NextResponse.json(
        {
          error:
            "Project not found",
        },
        {
          status: 404,
        },
      );
    }

    const runs =
      await loadLatestRuns(
        supabase,
        projectId,
      );

    const providers =
      getAIProviderStatuses(
        privacyMode,
      );

    const primary =
      providers.find(
        (provider) =>
          provider.eligible,
      ) ??
      null;

    return NextResponse.json({
      configured:
        Boolean(primary),

      provider:
        primary?.id ??
        null,

      model:
        primary?.model ??
        "No provider ready",

      privacyMode,

      providers,

      gate:
        context.gate,

      sourceFingerprint:
        context.packageFingerprint,

      latestRun:
        runs[0] ??
        null,

      runs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load AI strategist.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  const requestStarted =
    Date.now();

  const {
    supabase,
    user,
  } = await authenticatedAdmin();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  let body: {
    projectId?: unknown;
    privacyMode?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        projectId?: unknown;
        privacyMode?: unknown;
      };
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid JSON body",
      },
      {
        status: 400,
      },
    );
  }

  const projectId =
    typeof body.projectId ===
    "string"
      ? body.projectId
      : "";

  if (
    !uuidPattern.test(
      projectId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid project ID",
      },
      {
        status: 400,
      },
    );
  }

  const privacyMode =
    body.privacyMode ===
      undefined
      ? defaultAIPrivacyMode()
      : normalizeAIPrivacyMode(
          body.privacyMode,
        );

  let context:
    Awaited<
      ReturnType<
        typeof loadStrategyContext
      >
    >;

  try {
    context =
      await loadStrategyContext(
        supabase,
        projectId,
      );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not build strategy context.",
      },
      {
        status: 500,
      },
    );
  }

  if (!context) {
    return NextResponse.json(
      {
        error:
          "Project not found",
      },
      {
        status: 404,
      },
    );
  }

  if (!context.gate.ready) {
    return NextResponse.json(
      {
        error:
          "AI Strategist is locked until every strategy deliverable is evidence-ready and currently approved.",

        gate:
          context.gate,
      },
      {
        status: 409,
      },
    );
  }

  const providerStatuses =
    getAIProviderStatuses(
      privacyMode,
    );

  if (
    !providerStatuses.some(
      (provider) =>
        provider.eligible,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "No eligible AI provider is configured for this privacy mode.",

        privacyMode,

        providers:
          providerStatuses,
      },
      {
        status: 503,
      },
    );
  }

  let result:
    Awaited<
      ReturnType<
        typeof generateStrategyWithFailover
      >
    >;

  try {
    result =
      await generateStrategyWithFailover(
        {
          instructions:
            strategistInstructions,

          input:
            JSON.stringify(
              strategyInput(
                context,
              ),
            ),

          privacyMode,
        },
      );
  } catch (error) {
    const attempts =
      error instanceof
      AIRouterExhaustedError
        ? error.attempts
        : [];

    const message =
      error instanceof
      AIRouterExhaustedError
        ? error.message
        : "AI strategy generation failed before a valid strategy was returned.";

    const {
      error:
        failureInsertError,
    } = await supabase
      .from("strategy_ai_runs")
      .insert(
        failedRunValues({
          projectId,
          userId:
            user.id,
          sourceFingerprint:
            context.packageFingerprint,
          privacyMode,
          attempts,
          message,
          latencyMs:
            Date.now() -
            requestStarted,
        }),
      );

    return NextResponse.json(
      {
        error:
          message,

        attempts,

        privacyMode,

        failureLogged:
          !failureInsertError,

        providers:
          getAIProviderStatuses(
            privacyMode,
          ),
      },
      {
        status:
          error instanceof
          AIRouterExhaustedError
            ? 502
            : 500,
      },
    );
  }

  const {
    data: run,
    error: insertError,
  } = await supabase
    .from("strategy_ai_runs")
    .insert({
      project_id:
        projectId,

      requested_by:
        user.id,

      source_fingerprint:
        context.packageFingerprint,

      provider:
        result.provider,

      model:
        result.actualModel,

      prompt_version:
        AI_STRATEGIST_PROMPT_VERSION,

      status:
        "completed",

      output:
        result.output,

      error_message:
        null,

      provider_request_id:
        result.requestId,

      provider_attempts:
        result.attempts,

      privacy_mode:
        result.privacyMode,

      latency_ms:
        result.totalLatencyMs,

      openai_response_id:
        result.provider ===
          "openai"
          ? result.requestId
          : null,

      input_tokens:
        result.usage
          .inputTokens,

      output_tokens:
        result.usage
          .outputTokens,

      total_tokens:
        result.usage
          .totalTokens,
    })
    .select(
      [
        "id",
        "status",
        "provider",
        "model",
        "prompt_version",
        "source_fingerprint",
        "output",
        "error_message",
        "provider_request_id",
        "provider_attempts",
        "privacy_mode",
        "latency_ms",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "created_at",
      ].join(","),
    )
    .single();

  if (insertError) {
    return NextResponse.json(
      {
        error:
          "The AI provider returned a valid strategy, but ELLIPSIS could not persist the completed run. Do not regenerate until run storage is checked.",

        generated:
          true,

        persisted:
          false,

        provider:
          result.provider,

        providerLabel:
          providerLabel(
            result.provider,
          ),

        model:
          result.actualModel,

        attempts:
          result.attempts,

        privacyMode:
          result.privacyMode,
      },
      {
        status: 503,
      },
    );
  }

  return NextResponse.json({
    run,
    strategy:
      result.output,
    provider:
      result.provider,
    providerLabel:
      providerLabel(
        result.provider,
      ),
    model:
      result.actualModel,
    attempts:
      result.attempts,
    privacyMode:
      result.privacyMode,
    generated:
      true,
    persisted:
      true,
  });
}