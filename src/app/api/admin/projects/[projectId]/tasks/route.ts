import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  activeWorkspaceMember,
  authenticatedOwner,
  dateValue,
  integerValue,
  jsonError,
  jsonSuccess,
  milestoneBelongsToProject,
  nullableUuid,
  ownedProject,
  readJsonObject,
  taskPriorities,
  taskStatuses,
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
      "Task creation request origin was rejected.",
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
      "Invalid task creation request.",
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
      20000,
    );

  const status =
    textValue(
      body.status,
      20,
    ) ||
    "assigned";

  const priority =
    textValue(
      body.priority,
      20,
    ) ||
    "normal";

  const dueDate =
    dateValue(
      body.dueDate,
    );

  const milestoneId =
    nullableUuid(
      body.milestoneId,
    );

  const assigneeMemberId =
    nullableUuid(
      body.assigneeMemberId,
    );

  const rawSortOrder =
    body.sortOrder ??
    0;

  const sortOrder =
    integerValue(
      rawSortOrder,
    );

  if (!title) {
    return jsonError(
      "Task title is required.",
      400,
    );
  }

  if (
    !taskStatuses.has(
      status,
    )
  ) {
    return jsonError(
      "Choose a valid task status.",
      400,
    );
  }

  if (
    !taskPriorities.has(
      priority,
    )
  ) {
    return jsonError(
      "Choose a valid task priority.",
      400,
    );
  }

  if (
    dueDate ===
      undefined
  ) {
    return jsonError(
      "Enter a valid task due date.",
      400,
    );
  }

  if (
    milestoneId ===
      undefined
  ) {
    return jsonError(
      "Choose a valid milestone.",
      400,
    );
  }

  if (
    assigneeMemberId ===
      undefined
  ) {
    return jsonError(
      "Choose a valid task assignee.",
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
      "Task order must be zero or greater.",
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
      "Restore the project before creating tasks.",
      409,
    );
  }

  if (
    milestoneId
  ) {
    const {
      valid,
    } =
      await milestoneBelongsToProject(
        admin,
        user.id,
        projectId,
        milestoneId,
      );

    if (!valid) {
      return jsonError(
        "The selected milestone does not belong to this project.",
        400,
      );
    }
  }

  if (
    assigneeMemberId
  ) {
    const {
      valid,
    } =
      await activeWorkspaceMember(
        admin,
        assigneeMemberId,
      );

    if (!valid) {
      return jsonError(
        "The selected task assignee is not active.",
        400,
      );
    }
  }

  const {
    data:
      task,
    error:
      insertError,
  } =
    await admin
      .from(
        "studio_project_tasks",
      )
      .insert({
        project_id:
          projectId,
        created_by:
          user.id,
        milestone_id:
          milestoneId,
        assignee_member_id:
          assigneeMemberId,
        title,
        description,
        status,
        priority,
        due_date:
          dueDate,
        sort_order:
          sortOrder,
      })
      .select(
        "id,project_id,milestone_id,assignee_member_id,title,description,status,priority,due_date,sort_order,completed_at,created_at,updated_at",
      )
      .single();

  if (
    insertError ||
    !task
  ) {
    return jsonError(
      insertError
        ?.message ??
        "Could not create task.",
      409,
    );
  }

  return jsonSuccess(
    {
      task,
    },
    201,
  );
}