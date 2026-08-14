import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  authenticatedOwner,
  dateValue,
  integerValue,
  jsonError,
  jsonSuccess,
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
      "Milestone creation request origin was rejected.",
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
      "Invalid milestone creation request.",
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

  const rawSortOrder =
    body.sortOrder ??
    0;

  const sortOrder =
    integerValue(
      rawSortOrder,
    );

  const completed =
    body.completed ===
      true;

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
      "Restore the project before creating milestones.",
      409,
    );
  }

  const {
    data:
      milestone,
    error:
      insertError,
  } =
    await admin
      .from(
        "studio_project_milestones",
      )
      .insert({
        project_id:
          projectId,
        created_by:
          user.id,
        title,
        description,
        due_date:
          dueDate,
        completed_at:
          completed
            ? new Date()
                .toISOString()
            : null,
        sort_order:
          sortOrder,
      })
      .select(
        "id,project_id,title,description,due_date,completed_at,sort_order,created_at,updated_at",
      )
      .single();

  if (
    insertError ||
    !milestone
  ) {
    return jsonError(
      insertError
        ?.message ??
        "Could not create milestone.",
      409,
    );
  }

  return jsonSuccess(
    {
      milestone,
    },
    201,
  );
}