import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  type CreativeDirection,
  parseCreativeDirection,
} from "@/lib/creative-direction";

import {
  buildVisualSystemSeed,
  evaluateVisualSystemCompletion,
  parseVisualSystem,
  visualSystemPayloadSize,
  type VisualSystem,
  type VisualSystemVersion,
} from "@/lib/visual-system";

import {
  createClient,
} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_SYSTEM_BYTES =
  256 * 1024;

const MAX_NOTES_LENGTH =
  10000;

type ApprovedCreativeDirection = {
  id: string;
  version_number: number;
  direction: CreativeDirection;
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

async function loadApprovedDirections(
  supabase:
    Awaited<
      ReturnType<typeof createClient>
    >,
  projectId: string,
): Promise<
  ApprovedCreativeDirection[]
> {
  const {
    data,
    error,
  } = await supabase
    .from(
      "creative_direction_versions",
    )
    .select(
      "id,version_number,direction,approved_at",
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

  const directions:
    ApprovedCreativeDirection[] =
      [];

  for (
    const row of data ?? []
  ) {
    try {
      directions.push({
        id:
          row.id,

        version_number:
          row.version_number,

        direction:
          parseCreativeDirection(
            row.direction,
          ),

        approved_at:
          row.approved_at,
      });
    } catch {
      continue;
    }
  }

  return directions;
}

async function loadVisualVersions(
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
      "visual_system_versions",
    )
    .select(
      "id,project_id,version_number,status,source_creative_direction_version_id,source_creative_direction_version_number,system,editorial_notes,approved_at,created_at,updated_at",
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
    VisualSystemVersion[] =
      [];

  for (
    const row of data ?? []
  ) {
    let system:
      VisualSystem;

    try {
      system =
        parseVisualSystem(
          row.system,
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

      source_creative_direction_version_id:
        row
          .source_creative_direction_version_id,

      source_creative_direction_version_number:
        row
          .source_creative_direction_version_number,

      system,

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
    approvedDirections,
    versions,
  ] =
    await Promise.all([
      loadApprovedDirections(
        supabase,
        projectId,
      ),

      loadVisualVersions(
        supabase,
        projectId,
      ),
    ]);

  const latestDirection =
    approvedDirections[0] ??
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
      latestDirection &&
      draft
        .source_creative_direction_version_id ===
        latestDirection.id,
    );

  return {
    project,
    approvedDirections,
    latestDirection,
    versions,
    draft,
    approved,
    draftSourceCurrent,

    canCreateDraft:
      Boolean(
        latestDirection &&
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

      latestDirection:
        workspace.latestDirection
          ? {
              id:
                workspace
                  .latestDirection.id,

              versionNumber:
                workspace
                  .latestDirection
                  .version_number,

              approvedAt:
                workspace
                  .latestDirection
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
            : "Could not load visual system workspace.",
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
          "Invalid visual system action",
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
          .latestDirection
      ) {
        return NextResponse.json(
          {
            error:
              "Approve a Creative Direction version before creating a visual system.",
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
              "A visual system draft already exists.",
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

      const system =
        buildVisualSystemSeed(
          workspace
            .latestDirection
            .direction,
        );

      const {
        data,
        error,
      } = await supabase
        .from(
          "visual_system_versions",
        )
        .insert({
          project_id:
            projectId,

          version_number:
            nextVersion,

          status:
            "draft",

          source_creative_direction_version_id:
            workspace
              .latestDirection.id,

          source_creative_direction_version_number:
            workspace
              .latestDirection
              .version_number,

          system,

          editorial_notes:
            "",

          created_by:
            user.id,
        })
        .select(
          "id,project_id,version_number,status,source_creative_direction_version_id,source_creative_direction_version_number,system,editorial_notes,approved_at,created_at,updated_at",
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
            "Invalid visual system version ID",
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
            "Visual system draft not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !workspace
        .latestDirection ||
      draft
        .source_creative_direction_version_id !==
        workspace
          .latestDirection.id
    ) {
      return NextResponse.json(
        {
          error:
            "This visual system draft is based on an older Creative Direction. Discard it and create a new draft.",
        },
        {
          status: 409,
        },
      );
    }

    const completion =
      evaluateVisualSystemCompletion(
        draft.system,
      );

    if (
      !completion.ready
    ) {
      return NextResponse.json(
        {
          error:
            "Complete Palette Studio and Type Studio before visual system approval.",

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
        "visual_system_versions",
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
        draft.id,
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
        "id,project_id,version_number,status,source_creative_direction_version_id,source_creative_direction_version_number,system,editorial_notes,approved_at,created_at,updated_at",
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
            : "Could not update visual system.",
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
    system?: unknown;
    editorialNotes?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        projectId?: unknown;
        versionId?: unknown;
        system?: unknown;
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
    )
  ) {
    return invalidProject();
  }

  if (
    !uuidPattern.test(
      versionId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid visual system version ID",
      },
      {
        status: 400,
      },
    );
  }

  if (
    editorialNotes.length >
    MAX_NOTES_LENGTH
  ) {
    return NextResponse.json(
      {
        error:
          "Editorial notes are too long.",
      },
      {
        status: 413,
      },
    );
  }

  let parsed:
    VisualSystem;

  try {
    parsed =
      parseVisualSystem(
        body.system,
      );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Visual system is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    visualSystemPayloadSize(
      parsed,
    ) > MAX_SYSTEM_BYTES
  ) {
    return NextResponse.json(
      {
        error:
          "Visual system payload is too large.",
      },
      {
        status: 413,
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
            "Visual system draft not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !workspace
        .latestDirection ||
      draft
        .source_creative_direction_version_id !==
        workspace
          .latestDirection.id
    ) {
      return NextResponse.json(
        {
          error:
            "This visual system draft is based on an older Creative Direction. Discard it and create a new draft.",
        },
        {
          status: 409,
        },
      );
    }

    const sourceSeed =
      buildVisualSystemSeed(
        workspace
          .latestDirection
          .direction,
      );

    const protectedSystem:
      VisualSystem = {
        ...parsed,

        sourceBrief:
          sourceSeed
            .sourceBrief,
      };

    const now =
      new Date()
        .toISOString();

    const {
      data,
      error,
    } = await supabase
      .from(
        "visual_system_versions",
      )
      .update({
        system:
          protectedSystem,

        editorial_notes:
          editorialNotes,

        updated_at:
          now,
      })
      .eq(
        "id",
        draft.id,
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
        "id,project_id,version_number,status,source_creative_direction_version_id,source_creative_direction_version_number,system,editorial_notes,approved_at,created_at,updated_at",
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
            : "Could not save visual system.",
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

  let body: {
    projectId?: unknown;
    versionId?: unknown;
  };

  try {
    body =
      (await request.json()) as {
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

  if (
    !uuidPattern.test(
      projectId,
    )
  ) {
    return invalidProject();
  }

  if (
    !uuidPattern.test(
      versionId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid visual system version ID",
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
            "Visual system draft not found.",
        },
        {
          status: 404,
        },
      );
    }

    const {
      error,
    } = await supabase
      .from(
        "visual_system_versions",
      )
      .delete()
      .eq(
        "id",
        draft.id,
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
      deleted: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not discard visual system draft.",
      },
      {
        status: 500,
      },
    );
  }
}
