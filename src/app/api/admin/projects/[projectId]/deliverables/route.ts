import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  appendProjectActivityBestEffort,
} from "@/lib/server/project-activity";

import {
  authenticatedOwner,
  integerValue,
  jsonError,
  jsonSuccess,
  ownedProject,
  readJsonObject,
  trustedRequestOrigin,
  uuidPattern,
} from "@/lib/server/project-work";

import {
  boundedText,
  deliverableApprovalStatuses,
  deliverableReviewStatuses,
  deliverableSourceKinds,
  httpUrlValue,
  isProjectStoragePath,
  MAX_PROJECT_DELIVERABLE_BYTES,
  PROJECT_DELIVERABLE_BUCKET,
  projectDeliverableSelect,
  strictText,
} from "@/lib/server/project-deliverables";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


export async function POST(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        projectId: string;
      }>;
  },
) {
  const user =
    await authenticatedOwner();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
  }

  if (
    !trustedRequestOrigin(
      request,
    )
  ) {
    return jsonError(
      "Deliverable creation request origin was rejected.",
      403,
    );
  }

  const {
    projectId,
  } =
    await params;

  if (
    !uuidPattern.test(
      projectId,
    )
  ) {
    return jsonError(
      "Invalid project.",
      400,
    );
  }

  const body =
    await readJsonObject(
      request,
    );

  if (!body) {
    return jsonError(
      "Invalid deliverable creation request.",
      400,
    );
  }

  const title =
    strictText(
      body.title,
      240,
    );

  const description =
    boundedText(
      body.description,
      20000,
    );

  const deliverableType =
    strictText(
      body.deliverableType ??
        "general",
      80,
    );

  const sourceKind =
    strictText(
      body.sourceKind,
      40,
    );

  const versionNumber =
    integerValue(
      body.versionNumber ??
        1,
    );

  const reviewStatus =
    strictText(
      body.reviewStatus ??
        "not_started",
      40,
    );

  const approvalStatus =
    strictText(
      body.approvalStatus ??
        "not_requested",
      40,
    );

  const sortOrder =
    integerValue(
      body.sortOrder ??
        0,
    );

  if (!title) {
    return jsonError(
      "Deliverable title is required.",
      400,
    );
  }

  if (
    description ===
      null
  ) {
    return jsonError(
      "Deliverable description is too long or invalid.",
      400,
    );
  }

  if (!deliverableType) {
    return jsonError(
      "Deliverable type is required.",
      400,
    );
  }

  if (
    !sourceKind ||
    !deliverableSourceKinds.has(
      sourceKind,
    )
  ) {
    return jsonError(
      "Choose a valid deliverable source.",
      400,
    );
  }

  if (
    versionNumber ===
      null ||
    versionNumber <
      1
  ) {
    return jsonError(
      "Deliverable version must be 1 or greater.",
      400,
    );
  }

  if (
    !reviewStatus ||
    !deliverableReviewStatuses.has(
      reviewStatus,
    )
  ) {
    return jsonError(
      "Choose a valid review status.",
      400,
    );
  }

  if (
    !approvalStatus ||
    !deliverableApprovalStatuses.has(
      approvalStatus,
    )
  ) {
    return jsonError(
      "Choose a valid approval status.",
      400,
    );
  }

  if (
    sortOrder ===
      null ||
    sortOrder <
      0
  ) {
    return jsonError(
      "Deliverable order must be zero or greater.",
      400,
    );
  }

  if (
    body.delivered !==
      undefined &&
    typeof body.delivered !==
      "boolean"
  ) {
    return jsonError(
      "Delivered must be true or false.",
      400,
    );
  }

  const delivered =
    body.delivered ===
      true;

  const admin =
    createAdminClient();

  const {
    data:
      project,
    error:
      projectError,
  } =
    await ownedProject(
      admin,
      user.id,
      projectId,
    );

  if (
    projectError ||
    !project
  ) {
    return jsonError(
      "Project not found.",
      404,
    );
  }

  if (
    project.archived_at
  ) {
    return jsonError(
      "Restore the project before creating deliverables.",
      409,
    );
  }

  const baseInsert = {
    project_id:
      projectId,

    created_by:
      user.id,

    title,

    description,

    deliverable_type:
      deliverableType,

    source_kind:
      sourceKind,

    version_number:
      versionNumber,

    review_status:
      reviewStatus,

    approval_status:
      approvalStatus,

    delivered_at:
      delivered
        ? new Date()
            .toISOString()
        : null,

    sort_order:
      sortOrder,
  };


  if (
    sourceKind ===
      "external_url"
  ) {
    const externalUrl =
      httpUrlValue(
        body.externalUrl,
      );

    if (!externalUrl) {
      return jsonError(
        "Enter a valid HTTP or HTTPS deliverable URL.",
        400,
      );
    }

    const {
      data:
        deliverable,
      error:
        insertError,
    } =
      await admin
        .from(
          "studio_project_deliverables",
        )
        .insert({
          ...baseInsert,

          external_url:
            externalUrl,

          storage_bucket:
            null,

          storage_path:
            null,

          filename:
            null,

          mime_type:
            null,

          byte_size:
            null,

          sha256:
            null,
        })
        .select(
          projectDeliverableSelect,
        )
        .single();

    if (
      insertError ||
      !deliverable
    ) {
      return jsonError(
        insertError
          ?.message ??
          "Could not create deliverable.",
        409,
      );
    }

    await appendProjectActivityBestEffort(
      admin,
      {
        projectId,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "deliverable_created",
        entityType:
          "deliverable",
        entityId:
          deliverable.id,
        summary:
          `Deliverable created: ${deliverable.title}`,
        metadata: {
          sourceKind:
            deliverable.source_kind,
          versionNumber:
            deliverable.version_number,
          reviewStatus:
            deliverable.review_status,
          approvalStatus:
            deliverable.approval_status,
          deliveredAt:
            deliverable.delivered_at,
        },
      },
    );
    return jsonSuccess(
      {
        deliverable,
      },
      201,
    );
  }


  const storagePath =
    strictText(
      body.storagePath,
      1024,
    );

  const filename =
    strictText(
      body.filename,
      255,
    );

  const mimeType =
    strictText(
      body.mimeType ??
        "application/octet-stream",
      255,
    );

  const byteSize =
    integerValue(
      body.byteSize,
    );

  if (
    !storagePath ||
    !isProjectStoragePath(
      projectId,
      storagePath,
    )
  ) {
    return jsonError(
      "Invalid project deliverable storage path.",
      400,
    );
  }

  if (!filename) {
    return jsonError(
      "A file name is required.",
      400,
    );
  }

  if (!mimeType) {
    return jsonError(
      "A valid MIME type is required.",
      400,
    );
  }

  if (
    byteSize ===
      null ||
    byteSize <=
      0 ||
    byteSize >
      MAX_PROJECT_DELIVERABLE_BYTES
  ) {
    return jsonError(
      "File size must be between 1 byte and 50 MB.",
      400,
    );
  }

  const {
    data:
      existingRecord,
    error:
      existingError,
  } =
    await admin
      .from(
        "studio_project_deliverables",
      )
      .select(
        "id",
      )
      .eq(
        "storage_bucket",
        PROJECT_DELIVERABLE_BUCKET,
      )
      .eq(
        "storage_path",
        storagePath,
      )
      .maybeSingle();

  if (existingError) {
    return jsonError(
      existingError.message,
      409,
    );
  }

  if (existingRecord) {
    return jsonError(
      "This uploaded file is already registered as a deliverable.",
      409,
    );
  }

  const {
    data:
      fileInfo,
    error:
      fileInfoError,
  } =
    await admin.storage
      .from(
        PROJECT_DELIVERABLE_BUCKET,
      )
      .info(
        storagePath,
      );

  if (
    fileInfoError ||
    !fileInfo
  ) {
    return jsonError(
      "The uploaded file could not be verified in private storage.",
      409,
    );
  }

  if (
    typeof fileInfo.size ===
      "number" &&
    fileInfo.size !==
      byteSize
  ) {
    return jsonError(
      "Uploaded file size does not match the finalization request.",
      409,
    );
  }

  const {
    data:
      deliverable,
    error:
      insertError,
  } =
    await admin
      .from(
        "studio_project_deliverables",
      )
      .insert({
        ...baseInsert,

        external_url:
          null,

        storage_bucket:
          PROJECT_DELIVERABLE_BUCKET,

        storage_path:
          storagePath,

        filename,

        mime_type:
          mimeType,

        byte_size:
          byteSize,

        sha256:
          null,
      })
      .select(
        projectDeliverableSelect,
      )
      .single();

  if (
    insertError ||
    !deliverable
  ) {
    return jsonError(
      insertError
        ?.message ??
        "Could not finalize the file deliverable.",
      409,
    );
  }

  await appendProjectActivityBestEffort(
    admin,
    {
      projectId,
      actorUserId:
        user.id,
      actorRole:
        "owner",
      eventType:
        "deliverable_created",
      entityType:
        "deliverable",
      entityId:
        deliverable.id,
      summary:
        `Deliverable created: ${deliverable.title}`,
      metadata: {
        sourceKind:
          deliverable.source_kind,
        versionNumber:
          deliverable.version_number,
        reviewStatus:
          deliverable.review_status,
        approvalStatus:
          deliverable.approval_status,
        deliveredAt:
          deliverable.delivered_at,
      },
    },
  );
  return jsonSuccess(
    {
      deliverable,
    },
    201,
  );
}