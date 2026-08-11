import OpenAI from "openai";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  AI_STRATEGIST_DEFAULT_MODEL,
  AI_STRATEGIST_PROMPT_VERSION,
  AI_STRATEGY_SCHEMA,
  type AIStrategyOutput,
} from "@/lib/ai-strategy";

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
  status: "completed" | "failed";
  model: string;
  prompt_version: string;
  source_fingerprint: string;
  output: AIStrategyOutput | null;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
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
      "id,status,model,prompt_version,source_fingerprint,output,error_message,input_tokens,output_tokens,total_tokens,created_at",
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
  ) as StrategyRunRecord[];
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
  const reviewMap = new Map(
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
            reviewMap.get(item.id);

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
        error: "Unauthorized",
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
    !uuidPattern.test(projectId)
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

    return NextResponse.json({
      configured:
        Boolean(
          process.env
            .OPENAI_API_KEY,
        ),

      model:
        process.env
          .OPENAI_STRATEGIST_MODEL ||
        AI_STRATEGIST_DEFAULT_MODEL,

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
  const {
    supabase,
    user,
  } = await authenticatedAdmin();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  let body: {
    projectId?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        projectId?: unknown;
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

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured on the server.",
      },
      {
        status: 503,
      },
    );
  }

  const model =
    process.env
      .OPENAI_STRATEGIST_MODEL ||
    AI_STRATEGIST_DEFAULT_MODEL;

  const openai =
    new OpenAI({
      apiKey,
    });

  try {
    const response =
      await openai.responses.create({
        model,

        store: false,

        instructions:
          strategistInstructions,

        input:
          JSON.stringify(
            strategyInput(
              context,
            ),
          ),

        text: {
          format: {
            type:
              "json_schema",

            name:
              "ellipsis_brand_strategy",

            strict: true,

            schema:
              AI_STRATEGY_SCHEMA,
          },
        },
      });

    if (
      !response.output_text
    ) {
      throw new Error(
        "The AI Strategist returned an empty response.",
      );
    }

    const parsed =
      JSON.parse(
        response.output_text,
      ) as AIStrategyOutput;

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

        model,

        prompt_version:
          AI_STRATEGIST_PROMPT_VERSION,

        status:
          "completed",

        output:
          parsed,

        error_message:
          null,

        openai_response_id:
          response.id,

        input_tokens:
          response.usage
            ?.input_tokens ??
          null,

        output_tokens:
          response.usage
            ?.output_tokens ??
          null,

        total_tokens:
          response.usage
            ?.total_tokens ??
          null,
      })
      .select(
        [
          "id",
          "status",
          "model",
          "prompt_version",
          "source_fingerprint",
          "output",
          "error_message",
          "input_tokens",
          "output_tokens",
          "total_tokens",
          "created_at",
        ].join(","),
      )
      .single();

    if (insertError) {
      throw new Error(
        insertError.message,
      );
    }

    return NextResponse.json({
      run,
      strategy: parsed,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "AI strategy generation failed.";

    await supabase
      .from("strategy_ai_runs")
      .insert({
        project_id:
          projectId,

        requested_by:
          user.id,

        source_fingerprint:
          context.packageFingerprint,

        model,

        prompt_version:
          AI_STRATEGIST_PROMPT_VERSION,

        status:
          "failed",

        output:
          null,

        error_message:
          message,
      });

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}