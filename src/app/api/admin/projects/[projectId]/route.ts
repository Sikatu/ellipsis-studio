import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  appendProjectActivityBestEffort,
} from "@/lib/server/project-activity";
import {
  createClient,
} from "@/lib/supabase/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const statuses =
  new Set([
    "planned",
    "active",
    "on_hold",
    "completed",
    "cancelled",
  ]);

const priorities =
  new Set([
    "low",
    "normal",
    "high",
    "urgent",
  ]);

const currencies =
  new Set([
    "USD",
    "PHP",
    "AUD",
    "CAD",
    "GBP",
    "EUR",
  ]);

type JsonObject =
  Record<
    string,
    unknown
  >;

async function authenticatedAdmin() {
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
        "user_id",
      )
      .eq(
        "user_id",
        user.id,
      )
      .maybeSingle();

  return profile
    ? user
    : null;
}

function trustedRequestOrigin(
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

function text(
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

function integer(
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

function dateValue(
  value: unknown,
) {
  const result =
    text(
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

async function ownedProject(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
  projectId: string,
) {
  return admin
    .from(
      "studio_projects",
    )
    .select(
      "id,client_id,created_by,title,project_type,description,status,priority,start_date,target_date,completed_at,progress,archived_at,created_at,updated_at",
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

export async function PUT(
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
    await authenticatedAdmin();

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
      "Project update request origin was rejected.",
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

  let body:
    JsonObject;

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
      throw new Error(
        "Invalid body.",
      );
    }

    body =
      parsed as
        JsonObject;
  }
  catch {
    return jsonError(
      "Invalid project update request.",
      400,
    );
  }

  const title =
    text(
      body.title,
      240,
    );

  const projectType =
    text(
      body.projectType,
      80,
    ) ||
    "general";

  const description =
    text(
      body.description,
      20000,
    );

  const status =
    text(
      body.status,
      20,
    );

  const priority =
    text(
      body.priority,
      20,
    );

  const startDate =
    dateValue(
      body.startDate,
    );

  const targetDate =
    dateValue(
      body.targetDate,
    );

  const progress =
    integer(
      body.progress,
    );

  const archived =
    body.archived ===
      true;

  if (!title) {
    return jsonError(
      "Project title is required.",
      400,
    );
  }

  if (
    !statuses.has(
      status,
    )
  ) {
    return jsonError(
      "Choose a valid project status.",
      400,
    );
  }

  if (
    !priorities.has(
      priority,
    )
  ) {
    return jsonError(
      "Choose a valid project priority.",
      400,
    );
  }

  if (
    startDate ===
      undefined ||
    targetDate ===
      undefined
  ) {
    return jsonError(
      "Enter valid project dates.",
      400,
    );
  }

  if (
    startDate &&
    targetDate &&
    targetDate <
      startDate
  ) {
    return jsonError(
      "Target date cannot be before the start date.",
      400,
    );
  }

  if (
    progress ===
      null ||
    progress <
      0 ||
    progress >
      100
  ) {
    return jsonError(
      "Project progress must be between 0 and 100.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const {
    data:
      currentProject,
    error:
      currentError,
  } =
    await ownedProject(
      admin,
      user.id,
      projectId,
    );

  if (
    currentError ||
    !currentProject
  ) {
    return jsonError(
      "Project not found.",
      404,
    );
  }

  const completedAt =
    status ===
      "completed"
      ? currentProject
          .completed_at ??
        new Date()
          .toISOString()
      : null;

  const {
    data:
      project,
    error:
      updateError,
  } =
    await admin
      .from(
        "studio_projects",
      )
      .update({
        title,
        project_type:
          projectType,
        description,
        status,
        priority,
        start_date:
          startDate,
        target_date:
          targetDate,
        completed_at:
          completedAt,
        progress,
        archived_at:
          archived
            ? currentProject
                .archived_at ??
              new Date()
                .toISOString()
            : null,
      })
      .eq(
        "id",
        projectId,
      )
      .eq(
        "created_by",
        user.id,
      )
      .select(
        "id,client_id,title,project_type,description,status,priority,start_date,target_date,completed_at,progress,archived_at,created_at,updated_at",
      )
      .single();

  if (
    updateError ||
    !project
  ) {
    return jsonError(
      updateError
        ?.message ??
        "Could not update project.",
      409,
    );
  }

  if (
    currentProject.status !==
      project.status
  ) {
    await appendProjectActivityBestEffort(
      admin,
      {
        projectId:
          project.id,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "project_status_changed",
        entityType:
          "project",
        entityId:
          project.id,
        summary:
          `Project status changed from ${currentProject.status} to ${project.status}.`,
        metadata: {
          previousStatus:
            currentProject.status,
          status:
            project.status,
        },
      },
    );
  }

  if (
    !currentProject.archived_at &&
    project.archived_at
  ) {
    await appendProjectActivityBestEffort(
      admin,
      {
        projectId:
          project.id,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "project_archived",
        entityType:
          "project",
        entityId:
          project.id,
        summary:
          "Project archived.",
        metadata: {
          archivedAt:
            project.archived_at,
        },
      },
    );
  }

  if (
    currentProject.archived_at &&
    !project.archived_at
  ) {
    await appendProjectActivityBestEffort(
      admin,
      {
        projectId:
          project.id,
        actorUserId:
          user.id,
        actorRole:
          "owner",
        eventType:
          "project_restored",
        entityType:
          "project",
        entityId:
          project.id,
        summary:
          "Project restored.",
        metadata: {
          previousArchivedAt:
            currentProject.archived_at,
        },
      },
    );
  }
  return Response.json(
    {
      project,
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export async function PATCH(
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
    await authenticatedAdmin();

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
      "Project owner details request origin was rejected.",
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

  let body:
    JsonObject;

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
      throw new Error(
        "Invalid body.",
      );
    }

    body =
      parsed as
        JsonObject;
  }
  catch {
    return jsonError(
      "Invalid project owner details request.",
      400,
    );
  }

  const currency =
    text(
      body.currency,
      3,
    )
      .toUpperCase();

  const internalNotes =
    text(
      body.internalNotes,
      20000,
    );

  const rawBudget =
    body.budgetCents;

  const budgetCents =
    rawBudget ===
      null ||
    rawBudget ===
      undefined ||
    rawBudget ===
      ""
      ? null
      : integer(
          rawBudget,
        );

  if (
    !currencies.has(
      currency,
    )
  ) {
    return jsonError(
      "Choose a supported project currency.",
      400,
    );
  }

  if (
    budgetCents !==
      null &&
    (
      budgetCents <
        0 ||
      !Number.isSafeInteger(
        budgetCents,
      )
    )
  ) {
    return jsonError(
      "Enter a valid project budget.",
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

  const {
    data:
      ownerDetails,
    error:
      ownerDetailsError,
  } =
    await admin
      .from(
        "studio_project_owner_details",
      )
      .upsert(
        {
          project_id:
            projectId,
          created_by:
            user.id,
          budget_cents:
            budgetCents,
          currency,
          internal_notes:
            internalNotes,
        },
        {
          onConflict:
            "project_id",
        },
      )
      .select(
        "project_id,budget_cents,currency,internal_notes,created_at,updated_at",
      )
      .single();

  if (
    ownerDetailsError ||
    !ownerDetails
  ) {
    return jsonError(
      ownerDetailsError
        ?.message ??
        "Could not update project owner details.",
      409,
    );
  }

  return Response.json(
    {
      ownerDetails,
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}