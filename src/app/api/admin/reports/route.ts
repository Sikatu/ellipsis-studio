import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  isAIStrategyOutput,
} from "@/lib/final-strategy";

import {
  defaultReportConfiguration,
  normalizeReportConfiguration,
  reportConfigurationSize,
} from "@/lib/report-production";

import {
  createClient,
} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    .select(
      "id,title,client_id,created_by",
    )
    .eq(
      "id",
      projectId,
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return data;
}

async function loadApprovedVersions(
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
    data ??
    []
  ).filter(
    (version) =>
      isAIStrategyOutput(
        version.strategy,
      ),
  );
}

async function loadReports(
  supabase:
    Awaited<
      ReturnType<typeof createClient>
    >,
  projectId: string,
  brandName: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from("strategy_reports")
    .select(
      "id,project_id,report_number,status,source_strategy_version_id,source_strategy_version_number,strategy_snapshot,configuration,issued_at,created_at,updated_at",
    )
    .eq(
      "project_id",
      projectId,
    )
    .order(
      "report_number",
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
    data ??
    []
  )
    .filter(
      (report) =>
        isAIStrategyOutput(
          report.strategy_snapshot,
        ) &&
        (
          report.status ===
            "draft" ||
          report.status ===
            "ready" ||
          report.status ===
            "issued"
        ),
    )
    .map(
      (report) => ({
        ...report,

        configuration:
          normalizeReportConfiguration(
            report.configuration,
            brandName,
          ),
      }),
    );
}

async function loadReport(
  supabase:
    Awaited<
      ReturnType<typeof createClient>
    >,
  projectId: string,
  reportId: string,
  brandName: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from("strategy_reports")
    .select(
      "id,project_id,report_number,status,source_strategy_version_id,source_strategy_version_number,strategy_snapshot,configuration,issued_at,created_at,updated_at",
    )
    .eq(
      "id",
      reportId,
    )
    .eq(
      "project_id",
      projectId,
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  if (
    !data ||
    !isAIStrategyOutput(
      data.strategy_snapshot,
    )
  ) {
    return null;
  }

  return {
    ...data,

    configuration:
      normalizeReportConfiguration(
        data.configuration,
        brandName,
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
    const project =
      await loadProject(
        supabase,
        projectId,
      );

    if (!project) {
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

    const [
      approvedVersions,
      reports,
    ] =
      await Promise.all([
        loadApprovedVersions(
          supabase,
          projectId,
        ),

        loadReports(
          supabase,
          projectId,
          project.title,
        ),
      ]);

    const workingReport =
      reports.find(
        (report) =>
          report.status ===
            "draft" ||
          report.status ===
            "ready",
      ) ?? null;

    return NextResponse.json({
      project: {
        id:
          project.id,

        title:
          project.title,
      },

      approvedVersions:
        approvedVersions.map(
          (version) => ({
            id:
              version.id,

            versionNumber:
              version.version_number,

            approvedAt:
              version.approved_at,
          }),
        ),

      workingReport,

      reports,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load report production.",
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
    reportId?: unknown;
    sourceStrategyVersionId?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        action?: unknown;
        projectId?: unknown;
        reportId?: unknown;
        sourceStrategyVersionId?: unknown;
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
    action !== "ready" &&
    action !== "reopen" &&
    action !== "issue"
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid report action",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const project =
      await loadProject(
        supabase,
        projectId,
      );

    if (!project) {
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
      const sourceId =
        typeof body
          .sourceStrategyVersionId ===
          "string"
          ? body
              .sourceStrategyVersionId
          : "";

      if (
        !uuidPattern.test(
          sourceId,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Select an approved strategy version.",
          },
          {
            status: 400,
          },
        );
      }

      const {
        data: existing,
        error:
          existingError,
      } = await supabase
        .from(
          "strategy_reports",
        )
        .select(
          "id,status",
        )
        .eq(
          "project_id",
          projectId,
        )
        .in(
          "status",
          [
            "draft",
            "ready",
          ],
        )
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw new Error(
          existingError.message,
        );
      }

      if (existing) {
        return NextResponse.json(
          {
            error:
              "A working production report already exists.",
          },
          {
            status: 409,
          },
        );
      }

      const {
        data: source,
        error:
          sourceError,
      } = await supabase
        .from(
          "strategy_versions",
        )
        .select(
          "id,version_number,status,strategy",
        )
        .eq(
          "id",
          sourceId,
        )
        .eq(
          "project_id",
          projectId,
        )
        .eq(
          "status",
          "approved",
        )
        .maybeSingle();

      if (
        sourceError ||
        !source
      ) {
        return NextResponse.json(
          {
            error:
              "Approved strategy source not found.",
          },
          {
            status: 404,
          },
        );
      }

      if (
        !isAIStrategyOutput(
          source.strategy,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Approved strategy source is invalid.",
          },
          {
            status: 409,
          },
        );
      }

      const {
        data: latestReport,
        error:
          latestError,
      } = await supabase
        .from(
          "strategy_reports",
        )
        .select(
          "report_number",
        )
        .eq(
          "project_id",
          projectId,
        )
        .order(
          "report_number",
          {
            ascending:
              false,
          },
        )
        .limit(1)
        .maybeSingle();

      if (latestError) {
        throw new Error(
          latestError.message,
        );
      }

      const reportNumber =
        (
          latestReport
            ?.report_number ??
          0
        ) + 1;

      const configuration =
        defaultReportConfiguration(
          project.title,
        );

      const {
        data,
        error,
      } = await supabase
        .from(
          "strategy_reports",
        )
        .insert({
          project_id:
            projectId,

          report_number:
            reportNumber,

          status:
            "draft",

          source_strategy_version_id:
            source.id,

          source_strategy_version_number:
            source.version_number,

          strategy_snapshot:
            source.strategy,

          configuration,

          created_by:
            user.id,
        })
        .select(
          "id,project_id,report_number,status,source_strategy_version_id,source_strategy_version_number,strategy_snapshot,configuration,issued_at,created_at,updated_at",
        )
        .single();

      if (error) {
        throw new Error(
          error.message,
        );
      }

      return NextResponse.json({
        report: data,
      });
    }

    const reportId =
      typeof body.reportId ===
        "string"
        ? body.reportId
        : "";

    if (
      !uuidPattern.test(
        reportId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid production report ID",
        },
        {
          status: 400,
        },
      );
    }

    const report =
      await loadReport(
        supabase,
        projectId,
        reportId,
        project.title,
      );

    if (!report) {
      return NextResponse.json(
        {
          error:
            "Production report not found.",
        },
        {
          status: 404,
        },
      );
    }

    const now =
      new Date()
        .toISOString();

    if (
      action === "ready"
    ) {
      if (
        report.status !==
          "draft"
      ) {
        return NextResponse.json(
          {
            error:
              "Only a draft report can be marked ready.",
          },
          {
            status: 409,
          },
        );
      }

      if (
        report.configuration
          .includedSections
          .length === 0 ||
        !report.configuration
          .reportTitle
      ) {
        return NextResponse.json(
          {
            error:
              "Complete the report configuration before marking it ready.",
          },
          {
            status: 409,
          },
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          "strategy_reports",
        )
        .update({
          status:
            "ready",

          updated_at:
            now,
        })
        .eq(
          "id",
          reportId,
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
          "id,status,updated_at",
        )
        .single();

      if (error) {
        throw new Error(
          error.message,
        );
      }

      return NextResponse.json({
        report: data,
      });
    }

    if (
      action === "reopen"
    ) {
      if (
        report.status !==
          "ready"
      ) {
        return NextResponse.json(
          {
            error:
              "Only a ready report can return to draft.",
          },
          {
            status: 409,
          },
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          "strategy_reports",
        )
        .update({
          status:
            "draft",

          updated_at:
            now,
        })
        .eq(
          "id",
          reportId,
        )
        .eq(
          "project_id",
          projectId,
        )
        .eq(
          "status",
          "ready",
        )
        .select(
          "id,status,updated_at",
        )
        .single();

      if (error) {
        throw new Error(
          error.message,
        );
      }

      return NextResponse.json({
        report: data,
      });
    }

    if (
      report.status !==
        "ready"
    ) {
      return NextResponse.json(
        {
          error:
            "Only a ready report can be issued.",
        },
        {
          status: 409,
        },
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "strategy_reports",
      )
      .update({
        status:
          "issued",

        issued_by:
          user.id,

        issued_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        reportId,
      )
      .eq(
        "project_id",
        projectId,
      )
      .eq(
        "status",
        "ready",
      )
      .select(
        "id,status,issued_at",
      )
      .single();

    if (error) {
      throw new Error(
        error.message,
      );
    }

    return NextResponse.json({
      report: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Report production operation failed.",
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
    reportId?: unknown;
    configuration?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        projectId?: unknown;
        reportId?: unknown;
        configuration?: unknown;
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

  const reportId =
    typeof body.reportId ===
      "string"
      ? body.reportId
      : "";

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      reportId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid report update request",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const project =
      await loadProject(
        supabase,
        projectId,
      );

    if (!project) {
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

    const configuration =
      normalizeReportConfiguration(
        body.configuration,
        project.title,
      );

    if (
      reportConfigurationSize(
        configuration,
      ) > 20000
    ) {
      return NextResponse.json(
        {
          error:
            "Report configuration is too large.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "strategy_reports",
      )
      .update({
        configuration,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        reportId,
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
        "id,status,configuration,updated_at",
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
            "Editable report draft not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      report: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save report configuration.",
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

  const reportId =
    request.nextUrl
      .searchParams
      .get(
        "reportId",
      ) ?? "";

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      reportId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid report delete request",
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
        "strategy_reports",
      )
      .delete()
      .eq(
        "id",
        reportId,
      )
      .eq(
        "project_id",
        projectId,
      )
      .in(
        "status",
        [
          "draft",
          "ready",
        ],
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
            "Discardable report not found.",
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
            : "Could not discard production report.",
      },
      {
        status: 500,
      },
    );
  }
}