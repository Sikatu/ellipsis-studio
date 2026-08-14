import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  authenticatedOwner,
  dateValue,
  integerValue,
  jsonError,
  jsonSuccess,
  ownedMilestone,
  ownedProject,
  readJsonObject,
  textValue,
  trustedRequestOrigin,
  uuidPattern,
} from "@/lib/server/project-work";

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
        milestoneId: string;
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
      "Milestone update request origin was rejected.",
      403,
    );
  }

  const {
    projectId,
    milestoneId,
  } =
    await params;

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      milestoneId,
    )
  ) {
    return jsonError(
      "Invalid milestone.",
      400,
    );
  }

  const body =
    await readJsonObject(
      request,
    );

  if (!body) {
    return jsonError(
      "Invalid milestone update request.",
      400,
    );
  }

  const title =
    textValue(
      body.title,
      240,
    );

  const description =
    textValue(
      body.description,
      10000,
    );

  const dueDate =
    dateValue(
      body.dueDate,
    );

  const sortOrder =
    integerValue(
      body.sortOrder,
    );

  if (!title) {
    return jsonError(
      "Milestone title is required.",
      400,
    );
  }

  if (
    dueDate ===
      undefined
  ) {
    return jsonError(
      "Enter a valid milestone due date.",
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
      "Milestone order must be zero or greater.",
      400,
    );
  }

  if (
    typeof body.completed !==
      "boolean"
  ) {
    return jsonError(
      "Milestone completion state is required.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const [
    projectResult,
    milestoneResult,
  ] =
    await Promise.all([
      ownedProject(
        admin,
        user.id,
        projectId,
      ),
      ownedMilestone(
        admin,
        user.id,
        projectId,
        milestoneId,
      ),
    ]);

  if (
    projectResult.error ||
    !projectResult.data
  ) {
    return jsonError(
      "Project not found.",
      404,
    );
  }

  if (
    projectResult.data
      .archived_at
  ) {
    return jsonError(
      "Restore the project before updating milestones.",
      409,
    );
  }

  if (
    milestoneResult.error ||
    !milestoneResult.data
  ) {
    return jsonError(
      "Milestone not found.",
      404,
    );
  }

  const currentMilestone =
    milestoneResult.data;

  const completedAt =
    body.completed
      ? currentMilestone
          .completed_at ??
        new Date()
          .toISOString()
      : null;

  const {
    data:
      milestone,
    error:
      updateError,
  } =
    await admin
      .from(
        "studio_project_milestones",
      )
      .update({
        title,
        description,
        due_date:
          dueDate,
        completed_at:
          completedAt,
        sort_order:
          sortOrder,
      })
      .eq(
        "id",
        milestoneId,
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
        "id,project_id,title,description,due_date,completed_at,sort_order,created_at,updated_at",
      )
      .single();

  if (
    updateError ||
    !milestone
  ) {
    return jsonError(
      updateError
        ?.message ??
        "Could not update milestone.",
      409,
    );
  }

  return jsonSuccess({
    milestone,
  });
}