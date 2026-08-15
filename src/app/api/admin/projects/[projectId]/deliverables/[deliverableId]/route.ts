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
  httpUrlValue,
  ownedDeliverable,
  projectDeliverableSelect,
  strictText,
} from "@/lib/server/project-deliverables";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


export async function PUT(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        projectId: string;
        deliverableId: string;
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
      "Deliverable update request origin was rejected.",
      403,
    );
  }

  const {
    projectId,
    deliverableId,
  } =
    await params;

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      deliverableId,
    )
  ) {
    return jsonError(
      "Invalid deliverable.",
      400,
    );
  }

  const body =
    await readJsonObject(
      request,
    );

  if (!body) {
    return jsonError(
      "Invalid deliverable update request.",
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
      body.deliverableType,
      80,
    );

  const versionNumber =
    integerValue(
      body.versionNumber,
    );

  const reviewStatus =
    strictText(
      body.reviewStatus,
      40,
    );

  const approvalStatus =
    strictText(
      body.approvalStatus,
      40,
    );

  const sortOrder =
    integerValue(
      body.sortOrder,
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
    typeof body.delivered !==
      "boolean"
  ) {
    return jsonError(
      "Delivered must be true or false.",
      400,
    );
  }

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
      "Restore the project before changing deliverables.",
      409,
    );
  }

  const {
    data:
      current,
    error:
      currentError,
  } =
    await ownedDeliverable(
      admin,
      user.id,
      projectId,
      deliverableId,
    );

  if (
    currentError ||
    !current
  ) {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  if (
    body.sourceKind !==
      undefined &&
    body.sourceKind !==
      current.source_kind
  ) {
    return jsonError(
      "Deliverable source type is immutable. Create a new version instead.",
      409,
    );
  }

  let externalUrl:
    string |
    null =
      current.external_url;

  if (
    current.source_kind ===
      "external_url"
  ) {
    externalUrl =
      httpUrlValue(
        body.externalUrl,
      );

    if (!externalUrl) {
      return jsonError(
        "Enter a valid HTTP or HTTPS deliverable URL.",
        400,
      );
    }
  }

  const deliveredAt =
    body.delivered
      ? (
          current.delivered_at ??
          new Date()
            .toISOString()
        )
      : null;

  const {
    data:
      deliverable,
    error:
      updateError,
  } =
    await admin
      .from(
        "studio_project_deliverables",
      )
      .update({
        title,

        description,

        deliverable_type:
          deliverableType,

        version_number:
          versionNumber,

        review_status:
          reviewStatus,

        approval_status:
          approvalStatus,

        external_url:
          externalUrl,

        delivered_at:
          deliveredAt,

        sort_order:
          sortOrder,
      })
      .eq(
        "id",
        deliverableId,
      )
      .eq(
        "project_id",
        projectId,
      )
      .eq(
        "created_by",
        user.id,
      )
      .select(
        projectDeliverableSelect,
      )
      .single();

  if (
    updateError ||
    !deliverable
  ) {
    return jsonError(
      updateError
        ?.message ??
        "Could not update deliverable.",
      409,
    );
  }

  const changedFields =
    [
      current.title !==
        deliverable.title
        ? "title"
        : null,
      current.description !==
        deliverable.description
        ? "description"
        : null,
      current.deliverable_type !==
        deliverable.deliverable_type
        ? "deliverable_type"
        : null,
      current.version_number !==
        deliverable.version_number
        ? "version_number"
        : null,
      current.review_status !==
        deliverable.review_status
        ? "review_status"
        : null,
      current.external_url !==
        deliverable.external_url
        ? "external_url"
        : null,
      current.sort_order !==
        deliverable.sort_order
        ? "sort_order"
        : null,
    ].filter(
      (value): value is string =>
        Boolean(value),
    );

  if (
    changedFields.length > 0
  ) {
    await appendProjectActivityBestEffort(
      admin,
      {
        projectId,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "deliverable_updated",
        entityType:
          "deliverable",
        entityId:
          deliverable.id,
        summary:
          `Deliverable updated: ${deliverable.title}`,
        metadata: {
          changedFields,
          previousVersionNumber:
            current.version_number,
          versionNumber:
            deliverable.version_number,
          previousReviewStatus:
            current.review_status,
          reviewStatus:
            deliverable.review_status,
        },
      },
    );
  }

  if (
    current.approval_status !==
      deliverable.approval_status
  ) {
    await appendProjectActivityBestEffort(
      admin,
      {
        projectId,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "deliverable_approval_changed",
        entityType:
          "deliverable",
        entityId:
          deliverable.id,
        summary:
          `Deliverable approval changed from ${current.approval_status} to ${deliverable.approval_status}: ${deliverable.title}`,
        metadata: {
          previousApprovalStatus:
            current.approval_status,
          approvalStatus:
            deliverable.approval_status,
          approvedAt:
            deliverable.approved_at,
        },
      },
    );
  }

  if (
    !current.delivered_at &&
    deliverable.delivered_at
  ) {
    await appendProjectActivityBestEffort(
      admin,
      {
        projectId,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "deliverable_delivered",
        entityType:
          "deliverable",
        entityId:
          deliverable.id,
        summary:
          `Deliverable marked delivered: ${deliverable.title}`,
        metadata: {
          deliveredAt:
            deliverable.delivered_at,
        },
      },
    );
  }

  if (
    current.delivered_at &&
    !deliverable.delivered_at
  ) {
    await appendProjectActivityBestEffort(
      admin,
      {
        projectId,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "deliverable_delivery_reopened",
        entityType:
          "deliverable",
        entityId:
          deliverable.id,
        summary:
          `Deliverable delivery reopened: ${deliverable.title}`,
        metadata: {
          previousDeliveredAt:
            current.delivered_at,
        },
      },
    );
  }
  return jsonSuccess({
    deliverable,
  });
}