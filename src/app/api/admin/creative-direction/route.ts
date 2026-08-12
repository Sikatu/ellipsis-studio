import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildCreativeDirectionSeed,
  creativeDirectionPayloadSize,
  evaluateCreativeDirectionCompletion,
  parseCreativeDirection,
  type CreativeDirection,
  type CreativeDirectionVersion,
} from "@/lib/creative-direction";

import {
  isAIStrategyOutput,
} from "@/lib/final-strategy";

import {
  createClient,
} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApprovedStrategy = {
  id: string;
  version_number: number;
  strategy: unknown;
  approved_at: string | null;
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

async function loadProject(
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
    .from("discovery_projects")
    .select("id,title")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return data;
}

async function loadApprovedStrategies(
  supabase:
    Awaited<
      ReturnType<typeof createClient>
    >,
  projectId: string,
): Promise<ApprovedStrategy[]> {
  const {
    data,
    error,
  } = await supabase
    .from("strategy_versions")
    .select(
      "id,version_number,strategy,approved_at",
    )
    .eq(
      "project_id",
      projectId,
    )
    .eq(
      "status",
      "approved",
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

  return (
    data ?? []
  ).filter(
    (row) =>
      isAIStrategyOutput(
        row.strategy,
      ),
  );
}

async function loadDirectionVersions(
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
    .from(
      "creative_direction_versions",
    )
    .select(
      "id,project_id,version_number,status,source_strategy_version_id,source_strategy_version_number,direction,editorial_notes,approved_at,created_at,updated_at",
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
    CreativeDirectionVersion[] =
      [];

  for (
    const row of data ?? []
  ) {
    let direction:
      CreativeDirection;

    try {
      direction =
        parseCreativeDirection(
          row.direction,
        );
    } catch {
      continue;
    }

    if (
      row.status !==
        "draft" &&
      row.status !==
        "approved"
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

      source_strategy_version_id:
        row.source_strategy_version_id,

      source_strategy_version_number:
        row.source_strategy_version_number,

      direction,

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
  const project =
    await loadProject(
      supabase,
      projectId,
    );

  if (!project) {
    return null;
  }

  const [
    approvedStrategies,
    versions,
  ] =
    await Promise.all([
      loadApprovedStrategies(
        supabase,
        projectId,
      ),

      loadDirectionVersions(
        supabase,
        projectId,
      ),
    ]);

  const latestStrategy =
    approvedStrategies[0] ??
    null;

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

  const draftSourceCurrent =
    Boolean(
      draft &&
      latestStrategy &&
      draft
        .source_strategy_version_id ===
        latestStrategy.id,
    );

  return {
    project,
    approvedStrategies,
    latestStrategy,
    versions,
    draft,
    approved,
    draftSourceCurrent,

    canCreateDraft:
      Boolean(
        latestStrategy &&
        !draft,
      ),
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
    request.nextUrl
      .searchParams
      .get(
        "projectId",
      ) ?? "";

  if (
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
      project: {
        id:
          workspace.project.id,

        title:
          workspace.project.title,
      },

      latestStrategy:
        workspace.latestStrategy
          ? {
              id:
                workspace
                  .latestStrategy.id,

              versionNumber:
                workspace
                  .latestStrategy
                  .version_number,

              approvedAt:
                workspace
                  .latestStrategy
                  .approved_at,
            }
          : null,

      canCreateDraft:
        workspace.canCreateDraft,

      draftSourceCurrent:
        workspace
          .draftSourceCurrent,

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
            : "Could not load creative direction workspace.",
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
          "Invalid creative direction action",
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
          .latestStrategy
      ) {
        return NextResponse.json(
          {
            error:
              "Approve a final strategy version before creating creative direction.",
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
              "A creative direction draft already exists.",
          },
          {
            status: 409,
          },
        );
      }

      if (
        !isAIStrategyOutput(
          workspace
            .latestStrategy
            .strategy,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The latest approved strategy is invalid.",
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
                version
                  .version_number,
              ),
            0,
          ) + 1;

      const direction =
        buildCreativeDirectionSeed(
          workspace
            .latestStrategy
            .strategy,
        );

      const {
        data,
        error,
      } = await supabase
        .from(
          "creative_direction_versions",
        )
        .insert({
          project_id:
            projectId,

          version_number:
            nextVersion,

          status:
            "draft",

          source_strategy_version_id:
            workspace
              .latestStrategy.id,

          source_strategy_version_number:
            workspace
              .latestStrategy
              .version_number,

          direction,

          editorial_notes:
            "",

          created_by:
            user.id,
        })
        .select(
          "id,project_id,version_number,status,source_strategy_version_id,source_strategy_version_number,direction,editorial_notes,approved_at,created_at,updated_at",
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
            "Invalid creative direction version ID",
        },
        {
          status: 400,
        },
      );
    }

    const draft =
      workspace.versions
        .find(
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
            "Creative direction draft not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !workspace
        .latestStrategy ||
      draft
        .source_strategy_version_id !==
        workspace
          .latestStrategy.id
    ) {
      return NextResponse.json(
        {
          error:
            "This creative direction draft is based on an older approved strategy. Discard it and create a new draft.",
        },
        {
          status: 409,
        },
      );
    }

    const completion =
      evaluateCreativeDirectionCompletion(
        draft.direction,
      );

    if (
      !completion.ready
    ) {
      return NextResponse.json(
        {
          error:
            "Complete all creative direction modules before approval.",

          completion,
        },
        {
          status: 409,
        },
      );
    }

    const now =
      new Date()
        .toISOString();

    const {
      data,
      error,
    } = await supabase
      .from(
        "creative_direction_versions",
      )
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
        "id,project_id,version_number,status,source_strategy_version_id,source_strategy_version_number,direction,editorial_notes,approved_at,created_at,updated_at",
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
            : "Creative direction operation failed.",
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
    direction?: unknown;
    editorialNotes?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        projectId?: unknown;
        versionId?: unknown;
        direction?: unknown;
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
          "Invalid creative direction update request",
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

  let direction:
    CreativeDirection;

  try {
    direction =
      parseCreativeDirection(
        body.direction,
      );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid creative direction structure.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    creativeDirectionPayloadSize(
      direction,
    ) > 150000
  ) {
    return NextResponse.json(
      {
        error:
          "Creative direction content is too large.",
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

    if (
      !workspace ||
      !workspace.draft ||
      workspace.draft.id !==
        versionId
    ) {
      return NextResponse.json(
        {
          error:
            "Editable creative direction draft not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !workspace
        .latestStrategy ||
      workspace.draft
        .source_strategy_version_id !==
        workspace
          .latestStrategy.id
    ) {
      return NextResponse.json(
        {
          error:
            "This draft is based on an older approved strategy and can no longer be edited.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      !isAIStrategyOutput(
        workspace
          .latestStrategy
          .strategy,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The approved strategy source is invalid.",
        },
        {
          status: 409,
        },
      );
    }

    const sourceSeed =
      buildCreativeDirectionSeed(
        workspace
          .latestStrategy
          .strategy,
      );

    const protectedDirection:
      CreativeDirection = {
        ...direction,

        brandCore:
          sourceSeed.brandCore,
      };

    const now =
      new Date()
        .toISOString();

    const {
      data,
      error,
    } = await supabase
      .from(
        "creative_direction_versions",
      )
      .update({
        direction:
          protectedDirection,

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
        "id,project_id,version_number,status,source_strategy_version_id,source_strategy_version_number,direction,editorial_notes,approved_at,created_at,updated_at",
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
            "Editable creative direction draft not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      version: data,

      completion:
        evaluateCreativeDirectionCompletion(
          protectedDirection,
        ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save creative direction.",
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
    request.nextUrl
      .searchParams
      .get(
        "projectId",
      ) ?? "";

  const versionId =
    request.nextUrl
      .searchParams
      .get(
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
          "Invalid creative direction delete request",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const {
      data,
      error,
    } = await supabase
      .from(
        "creative_direction_versions",
      )
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
      )
      .select("id")
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
            "Discardable creative direction draft not found.",
        },
        {
          status: 404,
        },
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
            : "Could not discard creative direction draft.",
      },
      {
        status: 500,
      },
    );
  }
}