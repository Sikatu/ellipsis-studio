import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  createClient,
} from "@/lib/supabase/server";

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const taskStatuses =
  new Set([
    "assigned",
    "in_progress",
    "completed",
    "cancelled",
  ]);

export const taskPriorities =
  new Set([
    "low",
    "normal",
    "high",
    "urgent",
  ]);

export type JsonObject =
  Record<
    string,
    unknown
  >;

type AdminClient =
  ReturnType<
    typeof createAdminClient
  >;

export async function authenticatedOwner() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  if (!user) {
    return null;
  }

  const {
    data:
      profile,
  } =
    await supabase
      .from(
        "admin_profiles",
      )
      .select(
        "user_id,role",
      )
      .eq(
        "user_id",
        user.id,
      )
      .maybeSingle();

  return profile?.role ===
    "owner"
    ? user
    : null;
}

export function trustedRequestOrigin(
  request: Request,
) {
  const configured =
    (
      process.env
        .ELLIPSIS_PUBLIC_APP_URL ??
      ""
    ).trim();

  const supplied =
    request.headers
      .get(
        "origin",
      )
      ?.trim() ??
    "";

  if (!supplied) {
    return false;
  }

  try {
    const suppliedOrigin =
      new URL(
        supplied,
      ).origin;

    const requestOrigin =
      new URL(
        request.url,
      ).origin;

    const configuredOrigin =
      configured
        ? new URL(
            configured,
          ).origin
        : "";

    return (
      suppliedOrigin ===
        requestOrigin ||
      (
        Boolean(
          configuredOrigin,
        ) &&
        suppliedOrigin ===
          configuredOrigin
      )
    );
  }
  catch {
    return false;
  }
}

export function jsonError(
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
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "Referrer-Policy":
          "no-referrer",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export function jsonSuccess(
  payload: JsonObject,
  status = 200,
) {
  return Response.json(
    payload,
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export async function readJsonObject(
  request: Request,
) {
  try {
    const parsed =
      await request.json();

    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(
        parsed,
      )
    ) {
      return null;
    }

    return parsed as
      JsonObject;
  }
  catch {
    return null;
  }
}

export function textValue(
  value: unknown,
  maxLength: number,
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      maxLength,
    );
}

export function integerValue(
  value: unknown,
) {
  const parsed =
    Number(
      value,
    );

  return Number.isSafeInteger(
    parsed,
  )
    ? parsed
    : null;
}

export function dateValue(
  value: unknown,
) {
  const result =
    textValue(
      value,
      10,
    );

  if (!result) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      result,
    )
  ) {
    return undefined;
  }

  const [
    year,
    month,
    day,
  ] =
    result
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  if (
    Number.isNaN(
      date.getTime(),
    ) ||
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return undefined;
  }

  return result;
}

export function nullableUuid(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const result =
    value.trim();

  return uuidPattern.test(
    result,
  )
    ? result
    : undefined;
}

export async function ownedProject(
  admin: AdminClient,
  userId: string,
  projectId: string,
) {
  return admin
    .from(
      "studio_projects",
    )
    .select(
      "id,created_by,archived_at",
    )
    .eq(
      "id",
      projectId,
    )
    .eq(
      "created_by",
      userId,
    )
    .maybeSingle();
}

export async function ownedTask(
  admin: AdminClient,
  userId: string,
  projectId: string,
  taskId: string,
) {
  return admin
    .from(
      "studio_project_tasks",
    )
    .select(
      "id,project_id,created_by,milestone_id,assignee_member_id,title,description,status,priority,due_date,sort_order,completed_at,created_at,updated_at",
    )
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
      userId,
    )
    .maybeSingle();
}

export async function ownedMilestone(
  admin: AdminClient,
  userId: string,
  projectId: string,
  milestoneId: string,
) {
  return admin
    .from(
      "studio_project_milestones",
    )
    .select(
      "id,project_id,created_by,title,description,due_date,completed_at,sort_order,created_at,updated_at",
    )
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
      userId,
    )
    .maybeSingle();
}

export async function milestoneBelongsToProject(
  admin: AdminClient,
  userId: string,
  projectId: string,
  milestoneId: string,
) {
  const {
    data,
    error,
  } =
    await admin
      .from(
        "studio_project_milestones",
      )
      .select(
        "id",
      )
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
        userId,
      )
      .maybeSingle();

  return {
    valid:
      !error &&
      Boolean(data),
    error,
  };
}

export async function activeWorkspaceMember(
  admin: AdminClient,
  memberId: string,
) {
  const {
    data,
    error,
  } =
    await admin
      .from(
        "workspace_members",
      )
      .select(
        "id,status",
      )
      .eq(
        "id",
        memberId,
      )
      .eq(
        "status",
        "active",
      )
      .maybeSingle();

  return {
    valid:
      !error &&
      Boolean(data),
    error,
  };
}