import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  appendProjectActivity,
} from "@/lib/server/project-activity";

import {
  authenticatedOwner,
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
      "Project note request origin was rejected.",
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
      "Invalid project note request.",
      400,
    );
  }

  const note =
    textValue(
      body.note,
      4000,
    );

  if (!note) {
    return jsonError(
      "Project note is required.",
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
      "Restore the project before adding notes.",
      409,
    );
  }

  const {
    data:
      activity,
    error:
      activityError,
  } =
    await appendProjectActivity(
      admin,
      {
        projectId,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "project_note_added",
        summary:
          note,
        metadata: {
          source:
            "manual_note",
        },
      },
    );

  if (
    activityError ||
    !activity
  ) {
    return jsonError(
      activityError
        ?.message ??
        "Could not add project note.",
      409,
    );
  }

  return jsonSuccess(
    {
      activity,
    },
    201,
  );
}
