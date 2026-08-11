import {
  NextRequest,
  NextResponse,
} from "next/server";

import type {
  AIStrategyOutput,
} from "@/lib/ai-strategy";

import {
  isAIStrategyOutput,
  strategyPayloadSize,
  type FinalStrategyVersion,
} from "@/lib/final-strategy";

import {
  buildBrandIntelligence,
} from "@/lib/discovery-intelligence";

import {
  buildStrategySynthesis,
} from "@/lib/strategy-synthesis";

import {
  buildApprovedStrategyPackageFingerprint,
  evaluateStrategyApprovalGate,
  type StrategyReviewLike,
} from "@/lib/strategy-review";

import {
  createClient,
} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CompletedAIRun = {
  id: string;
  source_fingerprint: string;
  model: string;
  prompt_version: string;
  output: AIStrategyOutput;
  created_at: string;
};

async function authenticatedAdmin() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

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
    .eq(
      "user_id",
      user.id,
    )
    .maybeSingle();

  return {
    supabase,
    user:
      profile
        ? user
        : null,
  };
}

async function loadCurrentContext(
  supabase:
    Awaited<
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
      "id,title,created_by",
    )
    .eq(
      "id",
      projectId,
    )
    .maybeSingle();

  if (
    projectError ||
    !project
  ) {
    return null;
  }

  const {
    data: responses,
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
      responses ?? [],
    );

  const synthesis =
    buildStrategySynthesis(
      responses ?? [],
      intelligence,
    );

  const reviews =
    (reviewRows ??
      []) as unknown as
      StrategyReviewLike[];

  const gate =
    evaluateStrategyApprovalGate(
      synthesis,
      reviews,
    );

  const fingerprint =
    buildApprovedStrategyPackageFingerprint(
      synthesis,
      reviews,
    );

  return {
    project,
    gate,
    fingerprint,
  };
}

async function loadLatestCompletedAI(
  supabase:
    Awaited<
      ReturnType<typeof createClient>
    >,
  projectId: string,
): Promise<CompletedAIRun | null> {
  const {
    data,
    error,
  } = await supabase
    .from("strategy_ai_runs")
    .select(
      "id,source_fingerprint,model,prompt_version,output,created_at",
    )
    .eq(
      "project_id",
      projectId,
    )
    .eq(
      "status",
      "completed",
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  if (
    !data ||
    !isAIStrategyOutput(
      data.output,
    )
  ) {
    return null;
  }

  return {
    id:
      data.id,

    source_fingerprint:
      data.source_fingerprint,

    model:
      data.model,

    prompt_version:
      data.prompt_version,

    output:
      data.output,

    created_at:
      data.created_at,
  };
}

async function loadVersions(
  supabase:
    Awaited<
      ReturnType<typeof createClient>
    >,
  projectId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from("strategy_versions")
    .select(
      "id,project_id,version_number,status,source_ai_run_id,source_fingerprint,source_model,prompt_version,strategy,editorial_notes,approved_at,created_at,updated_at",
    )
    .eq(
      "project_id",
      projectId,
    )
    .order(
      "version_number",
      {
        ascending: false,
      },
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  const versions:
    FinalStrategyVersion[] =
      [];

  for (
    const row
    of data ?? []
  ) {
    if (
      !isAIStrategyOutput(
        row.strategy,
      )
    ) {
      continue;
    }

    if (
      row.status !== "draft" &&
      row.status !== "approved"
    ) {
      continue;
    }

    versions.push({
      id:
        row.id,

      project_id:
        row.project_id,

      version_number:
        row.version_number,

      status:
        row.status,

      source_ai_run_id:
        row.source_ai_run_id,

      source_fingerprint:
        row.source_fingerprint,

      source_model:
        row.source_model,

      prompt_version:
        row.prompt_version,

      strategy:
        row.strategy,

      editorial_notes:
        row.editorial_notes,

      approved_at:
        row.approved_at,

      created_at:
        row.created_at,

      updated_at:
        row.updated_at,
    });
  }

  return versions;
}

async function buildWorkspace(
  supabase:
    Awaited<
      ReturnType<typeof createClient>
    >,
  projectId: string,
) {
  const context =
    await loadCurrentContext(
      supabase,
      projectId,
    );

  if (!context) {
    return null;
  }

  const [
    versions,
    latestAI,
  ] =
    await Promise.all([
      loadVersions(
        supabase,
        projectId,
      ),

      loadLatestCompletedAI(
        supabase,
        projectId,
      ),
    ]);

  const draft =
    versions.find(
      (version) =>
        version.status ===
        "draft",
    ) ?? null;

  const approved =
    versions.filter(
      (version) =>
        version.status ===
        "approved",
    );

  const latestAIIsCurrent =
    Boolean(
      latestAI &&
      latestAI
        .source_fingerprint ===
        context.fingerprint,
    );

  return {
    context,
    versions,
    draft,
    approved,
    latestAI,
    latestAIIsCurrent,

    canCreateDraft:
      context.gate.ready &&
      latestAIIsCurrent &&
      draft === null,
  };
}

function invalidProject() {
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

export async function GET(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } =
    await authenticatedAdmin();

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
    return invalidProject();
  }

  try {
    const workspace =
      await buildWorkspace(
        supabase,
        projectId,
      );

    if (!workspace) {
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

    return NextResponse.json({
      gate:
        workspace.context.gate,

      currentFingerprint:
        workspace.context
          .fingerprint,

      latestAI:
        workspace.latestAI
          ? {
              id:
                workspace.latestAI.id,

              sourceFingerprint:
                workspace.latestAI
                  .source_fingerprint,

              model:
                workspace.latestAI.model,

              promptVersion:
                workspace.latestAI
                  .prompt_version,

              createdAt:
                workspace.latestAI
                  .created_at,

              current:
                workspace
                  .latestAIIsCurrent,
            }
          : null,

      canCreateDraft:
        workspace.canCreateDraft,

      draft:
        workspace.draft,

      approved:
        workspace.approved,

      versions:
        workspace.versions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load final strategy workspace.",
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
  } =
    await authenticatedAdmin();

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
    action?: unknown;
    projectId?: unknown;
    versionId?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        action?: unknown;
        projectId?: unknown;
        versionId?: unknown;
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

  const action =
    typeof body.action ===
      "string"
      ? body.action
      : "";

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
    return invalidProject();
  }

  if (
    action !== "create" &&
    action !== "approve"
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid strategy version action",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const workspace =
      await buildWorkspace(
        supabase,
        projectId,
      );

    if (!workspace) {
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

    if (
      action === "create"
    ) {
      if (
        !workspace
          .context.gate.ready
      ) {
        return NextResponse.json(
          {
            error:
              "The final strategy draft is locked until the evidence and studio approval gates pass.",
          },
          {
            status: 409,
          },
        );
      }

      if (
        !workspace.latestAI ||
        !workspace
          .latestAIIsCurrent
      ) {
        return NextResponse.json(
          {
            error:
              "Generate a current AI strategy before creating the final strategy draft.",
          },
          {
            status: 409,
          },
        );
      }

      if (workspace.draft) {
        return NextResponse.json(
          {
            error:
              "A final strategy draft already exists.",
          },
          {
            status: 409,
          },
        );
      }

      const nextVersion =
        workspace.versions
          .reduce(
            (
              highest,
              version,
            ) =>
              Math.max(
                highest,
                version.version_number,
              ),
            0,
          ) + 1;

      const {
        data,
        error,
      } = await supabase
        .from("strategy_versions")
        .insert({
          project_id:
            projectId,

          version_number:
            nextVersion,

          status:
            "draft",

          source_ai_run_id:
            workspace.latestAI.id,

          source_fingerprint:
            workspace.context
              .fingerprint,

          source_model:
            workspace.latestAI.model,

          prompt_version:
            workspace.latestAI
              .prompt_version,

          strategy:
            workspace.latestAI.output,

          editorial_notes:
            "",

          created_by:
            user.id,
        })
        .select(
          "id,project_id,version_number,status,source_ai_run_id,source_fingerprint,source_model,prompt_version,strategy,editorial_notes,approved_at,created_at,updated_at",
        )
        .single();

      if (error) {
        throw new Error(
          error.message,
        );
      }

      return NextResponse.json({
        version: data,
      });
    }

    const versionId =
      typeof body.versionId ===
        "string"
        ? body.versionId
        : "";

    if (
      !uuidPattern.test(
        versionId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid strategy version ID",
        },
        {
          status: 400,
        },
      );
    }

    const draft =
      workspace.versions.find(
        (version) =>
          version.id ===
            versionId &&
          version.status ===
            "draft",
      );

    if (!draft) {
      return NextResponse.json(
        {
          error:
            "Draft strategy version not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !workspace
        .context.gate.ready
    ) {
      return NextResponse.json(
        {
          error:
            "The strategy cannot be approved while the evidence or studio approval gate is incomplete.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      draft
        .source_fingerprint !==
      workspace.context
        .fingerprint
    ) {
      return NextResponse.json(
        {
          error:
            "The draft is based on older evidence. Generate a new AI strategy and create a new final draft.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      !draft.source_ai_run_id
    ) {
      return NextResponse.json(
        {
          error:
            "The draft no longer has a valid AI source run.",
        },
        {
          status: 409,
        },
      );
    }

    const {
      data: sourceRun,
      error: sourceRunError,
    } = await supabase
      .from("strategy_ai_runs")
      .select(
        "id,status,source_fingerprint",
      )
      .eq(
        "id",
        draft.source_ai_run_id,
      )
      .eq(
        "project_id",
        projectId,
      )
      .maybeSingle();

    if (
      sourceRunError ||
      !sourceRun ||
      sourceRun.status !==
        "completed" ||
      sourceRun
        .source_fingerprint !==
        workspace.context
          .fingerprint
    ) {
      return NextResponse.json(
        {
          error:
            "The draft AI source is no longer current.",
        },
        {
          status: 409,
        },
      );
    }

    const now =
      new Date().toISOString();

    const {
      data,
      error,
    } = await supabase
      .from("strategy_versions")
      .update({
        status:
          "approved",

        approved_by:
          user.id,

        approved_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        versionId,
      )
      .eq(
        "project_id",
        projectId,
      )
      .eq(
        "status",
        "draft",
      )
      .select(
        "id,project_id,version_number,status,source_ai_run_id,source_fingerprint,source_model,prompt_version,strategy,editorial_notes,approved_at,created_at,updated_at",
      )
      .single();

    if (error) {
      throw new Error(
        error.message,
      );
    }

    return NextResponse.json({
      version: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Strategy version operation failed.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } =
    await authenticatedAdmin();

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
    versionId?: unknown;
    strategy?: unknown;
    editorialNotes?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        projectId?: unknown;
        versionId?: unknown;
        strategy?: unknown;
        editorialNotes?: unknown;
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

  const versionId =
    typeof body.versionId ===
      "string"
      ? body.versionId
      : "";

  const editorialNotes =
    typeof body.editorialNotes ===
      "string"
      ? body.editorialNotes
      : "";

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      versionId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid strategy version request",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isAIStrategyOutput(
      body.strategy,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid final strategy structure",
      },
      {
        status: 400,
      },
    );
  }

  if (
    strategyPayloadSize(
      body.strategy,
    ) > 100000
  ) {
    return NextResponse.json(
      {
        error:
          "Final strategy content is too large.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    editorialNotes.length >
      10000
  ) {
    return NextResponse.json(
      {
        error:
          "Editorial notes are too long.",
      },
      {
        status: 400,
      },
    );
  }

  const now =
    new Date().toISOString();

  try {
    const {
      data,
      error,
    } = await supabase
      .from("strategy_versions")
      .update({
        strategy:
          body.strategy,

        editorial_notes:
          editorialNotes,

        updated_at:
          now,
      })
      .eq(
        "id",
        versionId,
      )
      .eq(
        "project_id",
        projectId,
      )
      .eq(
        "status",
        "draft",
      )
      .select(
        "id,project_id,version_number,status,source_ai_run_id,source_fingerprint,source_model,prompt_version,strategy,editorial_notes,approved_at,created_at,updated_at",
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message,
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Editable strategy draft not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      version: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save final strategy draft.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } =
    await authenticatedAdmin();

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
    ) ?? "";

  const versionId =
    request.nextUrl.searchParams.get(
      "versionId",
    ) ?? "";

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      versionId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid strategy version request",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const {
      error,
    } = await supabase
      .from("strategy_versions")
      .delete()
      .eq(
        "id",
        versionId,
      )
      .eq(
        "project_id",
        projectId,
      )
      .eq(
        "status",
        "draft",
      );

    if (error) {
      throw new Error(
        error.message,
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not discard strategy draft.",
      },
      {
        status: 500,
      },
    );
  }
}