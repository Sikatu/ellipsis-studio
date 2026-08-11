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

const DELIVERABLE_BUCKET =
  "brand-deliverables";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdminContext = {
  supabase:
    Awaited<
      ReturnType<
        typeof createClient
      >
    >;

  user:
    | {
        id: string;
      }
    | null;
};

async function authenticatedAdmin():
  Promise<AdminContext> {
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
  } = await supabase
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
        ? {
            id:
              user.id,
          }
        : null,
  };
}

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
  bytes:
    | Uint8Array
    | Buffer,
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

async function ensurePrivateBucket() {
  const admin =
    createAdminClient();

  const {
    data: bucket,
    error,
  } =
    await admin.storage
      .getBucket(
        DELIVERABLE_BUCKET,
      );

  if (
    !error &&
    bucket
  ) {
    if (
      bucket.public
    ) {
      throw new Error(
        "Deliverable Storage bucket must remain private.",
      );
    }

    return admin;
  }

  const {
    error:
      createError,
  } =
    await admin.storage
      .createBucket(
        DELIVERABLE_BUCKET,
        {
          public:
            false,

          allowedMimeTypes:
            [
              "application/pdf",
            ],

          fileSizeLimit:
            "10MB",
        },
      );

  if (createError) {
    throw new Error(
      `Could not create private deliverable bucket: ${createError.message}`,
    );
  }

  return admin;
}

async function authorizeProject(
  supabase:
    AdminContext["supabase"],
  projectId: string,
) {
  const {
    data: project,
    error,
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
    error ||
    !project
  ) {
    return null;
  }

  return project;
}

async function downloadStoredArtifact({
  storageBucket,
  storagePath,
  expectedSha256,
}: {
  storageBucket: string;

  storagePath: string;

  expectedSha256: string;
}) {
  const admin =
    createAdminClient();

  const {
    data,
    error,
  } =
    await admin.storage
      .from(
        storageBucket,
      )
      .download(
        storagePath,
      );

  if (
    error ||
    !data
  ) {
    throw new Error(
      error?.message ||
        "Stored deliverable file could not be downloaded.",
    );
  }

  const bytes =
    new Uint8Array(
      await data.arrayBuffer(),
    );

  const actualSha256 =
    sha256Hex(
      bytes,
    );

  if (
    actualSha256 !==
    expectedSha256
  ) {
    throw new Error(
      "Stored deliverable failed SHA-256 integrity verification.",
    );
  }

  return bytes;
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

  const fileId =
    request.nextUrl
      .searchParams
      .get(
        "fileId",
      );

  if (fileId) {
    if (
      !uuidPattern.test(
        fileId,
      )
    ) {
      return jsonError(
        "Invalid deliverable file ID.",
        400,
      );
    }

    const admin =
      createAdminClient();

    const {
      data: file,
      error,
    } =
      await admin
        .from(
          "strategy_report_files",
        )
        .select(
          "id,project_id,report_id,report_number,storage_bucket,storage_path,filename,mime_type,byte_size,sha256,source_strategy_version_number,generated_at",
        )
        .eq(
          "id",
          fileId,
        )
        .maybeSingle();

    if (
      error ||
      !file
    ) {
      return jsonError(
        "Deliverable not found.",
        404,
      );
    }

    const project =
      await authorizeProject(
        supabase,
        file.project_id,
      );

    if (!project) {
      return jsonError(
        "Deliverable not found.",
        404,
      );
    }

    try {
      const bytes =
        await downloadStoredArtifact({
          storageBucket:
            file.storage_bucket,

          storagePath:
            file.storage_path,

          expectedSha256:
            file.sha256,
        });

      return new Response(
        bytes,
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/pdf",

            "Content-Disposition":
              `attachment; filename="${file.filename}"`,

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
              file.sha256,
          },
        },
      );
    }
    catch (downloadError) {
      return jsonError(
        downloadError instanceof Error
          ? downloadError.message
          : "Deliverable download failed.",
        409,
      );
    }
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
    return jsonError(
      "Invalid project ID.",
      400,
    );
  }

  const project =
    await authorizeProject(
      supabase,
      projectId,
    );

  if (!project) {
    return jsonError(
      "Project not found.",
      404,
    );
  }

  const admin =
    createAdminClient();

  const {
    data:
      deliverables,
    error,
  } =
    await admin
      .from(
        "strategy_report_files",
      )
      .select(
        "id,project_id,report_id,report_number,filename,mime_type,byte_size,sha256,source_strategy_version_number,generated_at,created_at",
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
      );

  if (error) {
    return jsonError(
      error.message,
      500,
    );
  }

  return Response.json(
    {
      deliverables:
        deliverables ?? [],
    },
  );
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
    return jsonError(
      "Unauthorized",
      401,
    );
  }

  let body:
    unknown;

  try {
    body =
      await request.json();
  }
  catch {
    return jsonError(
      "Invalid request body.",
      400,
    );
  }

  if (
    !body ||
    typeof body !==
      "object"
  ) {
    return jsonError(
      "Invalid request body.",
      400,
    );
  }

  const payload =
    body as Record<
      string,
      unknown
    >;

  if (
    payload.action !==
    "seal_and_issue"
  ) {
    return jsonError(
      "Unsupported deliverable action.",
      400,
    );
  }

  const projectId =
    typeof payload.projectId ===
      "string"
      ? payload.projectId
      : "";

  const reportId =
    typeof payload.reportId ===
      "string"
      ? payload.reportId
      : "";

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      reportId,
    )
  ) {
    return jsonError(
      "Invalid deliverable request.",
      400,
    );
  }

  const project =
    await authorizeProject(
      supabase,
      projectId,
    );

  if (!project) {
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
        "id,project_id,report_number,status,source_strategy_version_id,source_strategy_version_number,strategy_snapshot,configuration,issued_at,updated_at",
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

  const {
    data:
      existingArtifact,
  } =
    await admin
      .from(
        "strategy_report_files",
      )
      .select(
        "id,report_id,project_id,report_number,source_strategy_version_id,source_strategy_version_number,storage_bucket,storage_path,filename,mime_type,byte_size,sha256,generated_by,generated_at,created_at",
      )
      .eq(
        "report_id",
        report.id,
      )
      .maybeSingle();

  if (
    report.status ===
      "issued"
  ) {
    if (
      existingArtifact
    ) {
      return Response.json(
        {
          deliverable:
            existingArtifact,

          alreadyIssued:
            true,
        },
      );
    }

    return jsonError(
      "Issued report has no sealed deliverable metadata.",
      409,
    );
  }

  if (
    report.status !==
      "ready"
  ) {
    return jsonError(
      "Only Ready reports can be sealed and issued.",
      409,
    );
  }

  if (
    existingArtifact
  ) {
    try {
      await downloadStoredArtifact({
        storageBucket:
          existingArtifact
            .storage_bucket,

        storagePath:
          existingArtifact
            .storage_path,

        expectedSha256:
          existingArtifact
            .sha256,
      });

      const {
        error:
          recoveryIssueError,
      } =
        await admin
          .from(
            "strategy_reports",
          )
          .update({
            status:
              "issued",

            issued_by:
              user.id,

            issued_at:
              existingArtifact
                .generated_at,
          })
          .eq(
            "id",
            report.id,
          )
          .eq(
            "status",
            "ready",
          );

      if (
        recoveryIssueError
      ) {
        return jsonError(
          recoveryIssueError.message,
          409,
        );
      }

      return Response.json(
        {
          deliverable:
            existingArtifact,

          recovered:
            true,
        },
      );
    }
    catch {
      await admin
        .from(
          "strategy_report_files",
        )
        .delete()
        .eq(
          "id",
          existingArtifact.id,
        );

      await admin.storage
        .from(
          existingArtifact
            .storage_bucket,
        )
        .remove([
          existingArtifact
            .storage_path,
        ]);
    }
  }

  const sealedAt =
    new Date()
      .toISOString();

  let rendered;

  try {
    rendered =
      await renderStrategyReportPdf({
        brandName:
          project.title,

        reportNumber:
          report.report_number,

        status:
          "issued",

        sourceStrategyVersionNumber:
          report
            .source_strategy_version_number,

        strategySnapshot:
          report.strategy_snapshot,

        configuration:
          report.configuration,

        issuedAt:
          sealedAt,

        updatedAt:
          report.updated_at,
      });
  }
  catch (renderError) {
    return jsonError(
      renderError instanceof Error
        ? renderError.message
        : "Could not render final deliverable PDF.",
      409,
    );
  }

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

  const storagePath =
    [
      projectId,
      `report-${report.report_number}`,
      filename,
    ].join("/");

  const bytes =
    new Uint8Array(
      rendered.buffer,
    );

  const sha256 =
    sha256Hex(
      bytes,
    );

  let storageAdmin;

  try {
    storageAdmin =
      await ensurePrivateBucket();
  }
  catch (bucketError) {
    return jsonError(
      bucketError instanceof Error
        ? bucketError.message
        : "Private deliverable bucket is unavailable.",
      500,
    );
  }

  await storageAdmin.storage
    .from(
      DELIVERABLE_BUCKET,
    )
    .remove([
      storagePath,
    ]);

  const {
    error:
      uploadError,
  } =
    await storageAdmin.storage
      .from(
        DELIVERABLE_BUCKET,
      )
      .upload(
        storagePath,
        bytes,
        {
          contentType:
            "application/pdf",

          cacheControl:
            "3600",

          upsert:
            false,
        },
      );

  if (uploadError) {
    return jsonError(
      `Could not store final deliverable: ${uploadError.message}`,
      500,
    );
  }

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
      .insert({
        report_id:
          report.id,

        project_id:
          projectId,

        report_number:
          report.report_number,

        source_strategy_version_id:
          report
            .source_strategy_version_id,

        source_strategy_version_number:
          report
            .source_strategy_version_number,

        storage_bucket:
          DELIVERABLE_BUCKET,

        storage_path:
          storagePath,

        filename,

        mime_type:
          "application/pdf",

        byte_size:
          bytes.byteLength,

        sha256,

        generated_by:
          user.id,

        generated_at:
          sealedAt,
      })
      .select(
        "id,report_id,project_id,report_number,source_strategy_version_id,source_strategy_version_number,storage_bucket,storage_path,filename,mime_type,byte_size,sha256,generated_by,generated_at,created_at",
      )
      .single();

  if (
    artifactError ||
    !artifact
  ) {
    await storageAdmin.storage
      .from(
        DELIVERABLE_BUCKET,
      )
      .remove([
        storagePath,
      ]);

    return jsonError(
      artifactError?.message ||
        "Could not register sealed deliverable.",
      500,
    );
  }

  const {
    error:
      issueError,
  } =
    await admin
      .from(
        "strategy_reports",
      )
      .update({
        status:
          "issued",

        issued_by:
          user.id,

        issued_at:
          sealedAt,
      })
      .eq(
        "id",
        report.id,
      )
      .eq(
        "status",
        "ready",
      );

  if (issueError) {
    await admin
      .from(
        "strategy_report_files",
      )
      .delete()
      .eq(
        "id",
        artifact.id,
      );

    await storageAdmin.storage
      .from(
        DELIVERABLE_BUCKET,
      )
      .remove([
        storagePath,
      ]);

    return jsonError(
      issueError.message,
      409,
    );
  }

  return Response.json(
    {
      deliverable:
        artifact,

      sealed:
        true,

      sha256,
    },
    {
      status: 201,
    },
  );
}