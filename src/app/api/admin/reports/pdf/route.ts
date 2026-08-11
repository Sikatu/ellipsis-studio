import {
  createHash,
} from "node:crypto";

import type {
  NextRequest,
} from "next/server";

import {
  buildReportPdfFilename,
  renderStrategyReportPdf,
} from "@/lib/deliverable-pdf";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(
  message: string,
  status: number,
) {
  return Response.json(
    {
      error:
        message,
    },
    {
      status,
    },
  );
}

function sha256Hex(
  bytes: Uint8Array,
) {
  return createHash(
    "sha256",
  )
    .update(
      bytes,
    )
    .digest(
      "hex",
    );
}

async function authenticatedAdmin() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
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
  } =
    await supabase
      .from(
        "admin_profiles",
      )
      .select(
        "user_id",
      )
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

export async function GET(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } =
    await authenticatedAdmin();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
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
    return jsonError(
      "Invalid PDF export request.",
      400,
    );
  }

  const {
    data: project,
    error:
      projectError,
  } =
    await supabase
      .from(
        "discovery_projects",
      )
      .select(
        "id,title",
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
    return jsonError(
      "Project not found.",
      404,
    );
  }

  const admin =
    createAdminClient();

  const {
    data: report,
    error:
      reportError,
  } =
    await admin
      .from(
        "strategy_reports",
      )
      .select(
        "id,project_id,report_number,status,source_strategy_version_number,strategy_snapshot,configuration,issued_at,updated_at",
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

  if (
    reportError ||
    !report
  ) {
    return jsonError(
      "Production report not found.",
      404,
    );
  }

  if (
    report.status !==
      "ready" &&
    report.status !==
      "issued"
  ) {
    return jsonError(
      "PDF export is available only for Ready or Issued reports.",
      409,
    );
  }

  if (
    report.status ===
    "issued"
  ) {
    const {
      data:
        artifact,
      error:
        artifactError,
    } =
      await admin
        .from(
          "strategy_report_files",
        )
        .select(
          "id,storage_bucket,storage_path,filename,mime_type,byte_size,sha256",
        )
        .eq(
          "report_id",
          report.id,
        )
        .maybeSingle();

    if (
      artifactError ||
      !artifact
    ) {
      return jsonError(
        "Issued report does not have a sealed deliverable file.",
        409,
      );
    }

    const {
      data:
        storedFile,
      error:
        downloadError,
    } =
      await admin.storage
        .from(
          artifact
            .storage_bucket,
        )
        .download(
          artifact
            .storage_path,
        );

    if (
      downloadError ||
      !storedFile
    ) {
      return jsonError(
        downloadError?.message ||
          "Stored deliverable could not be downloaded.",
        409,
      );
    }

    const bytes =
      new Uint8Array(
        await storedFile
          .arrayBuffer(),
      );

    const actualSha256 =
      sha256Hex(
        bytes,
      );

    if (
      actualSha256 !==
      artifact.sha256
    ) {
      return jsonError(
        "Stored deliverable failed SHA-256 integrity verification.",
        409,
      );
    }

    return new Response(
      bytes,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${artifact.filename}"`,

          "Content-Length":
            String(
              bytes.byteLength,
            ),

          "Cache-Control":
            "private, no-store, max-age=0",

          "Pragma":
            "no-cache",

          "X-Content-Type-Options":
            "nosniff",

          "X-ELLIPSIS-SHA256":
            artifact.sha256,
        },
      },
    );
  }

  try {
    const {
      buffer,
    } =
      await renderStrategyReportPdf({
        brandName:
          project.title,

        reportNumber:
          report.report_number,

        status:
          "ready",

        sourceStrategyVersionNumber:
          report
            .source_strategy_version_number,

        strategySnapshot:
          report.strategy_snapshot,

        configuration:
          report.configuration,

        issuedAt:
          null,

        updatedAt:
          report.updated_at,
      });

    const filename =
      buildReportPdfFilename({
        brandName:
          project.title,

        reportNumber:
          report.report_number,

        sourceStrategyVersionNumber:
          report
            .source_strategy_version_number,
      });

    return new Response(
      new Uint8Array(
        buffer,
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${filename}"`,

          "Content-Length":
            String(
              buffer.byteLength,
            ),

          "Cache-Control":
            "private, no-store, max-age=0",

          "Pragma":
            "no-cache",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  }
  catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Native PDF generation failed.",
      500,
    );
  }
}