import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  appendProjectActivityBestEffort,
} from "@/lib/server/project-activity";
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
  ownedTask,
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

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        projectId: string;
        taskId: string;
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
      "Task update request origin was rejected.",
      403,
    );
  }

  const {
    projectId,
    taskId,
  } =
    await params;

  if (
    !uuidPattern.test(
      projectId,
    ) ||
    !uuidPattern.test(
      taskId,
    )
  ) {
    return jsonError(
      "Invalid task.",
      400,
    );
  }

  const body =
    await readJsonObject(
      request,
    );

  if (!body) {
    return jsonError(
      "Invalid task update request.",
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
    );

  const priority =
    textValue(
      body.priority,
      20,
    );

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

  const sortOrder =
    integerValue(
      body.sortOrder,
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

  const [
    projectResult,
    taskResult,
  ] =
    await Promise.all([
      ownedProject(
        admin,
        user.id,
        projectId,
      ),
      ownedTask(
        admin,
        user.id,
        projectId,
        taskId,
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
      "Restore the project before updating tasks.",
      409,
    );
  }

  if (
    taskResult.error ||
    !taskResult.data
  ) {
    return jsonError(
      "Task not found.",
      404,
    );
  }

  const currentTask =
    taskResult.data;

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
    assigneeMemberId &&
    assigneeMemberId !==
      currentTask
        .assignee_member_id
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
      updateError,
  } =
    await admin
      .from(
        "studio_project_tasks",
      )
      .update({
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
      .eq(
        "id",
        taskId,
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
        "id,project_id,milestone_id,assignee_member_id,title,description,status,priority,due_date,sort_order,completed_at,created_at,updated_at",
      )
      .single();

  if (
    updateError ||
    !task
  ) {
    return jsonError(
      updateError
        ?.message ??
        "Could not update task.",
      409,
    );
  }

  if (
    currentTask.status !==
      "completed" &&
    task.status ===
      "completed"
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
          "task_completed",
        entityType:
          "task",
        entityId:
          task.id,
        summary:
          `Task completed: ${task.title}`,
        metadata: {
          previousStatus:
            currentTask.status,
          status:
            task.status,
          completedAt:
            task.completed_at,
        },
      },
    );
  }

  if (
    currentTask.status ===
      "completed" &&
    task.status !==
      "completed"
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
          "task_reopened",
        entityType:
          "task",
        entityId:
          task.id,
        summary:
          `Task reopened: ${task.title}`,
        metadata: {
          previousStatus:
            currentTask.status,
          status:
            task.status,
        },
      },
    );
  }
  return jsonSuccess({
    task,
  });
}